import { Request, Response } from 'express';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import prisma from '../utils/prisma';
import { QUARTER_MONTHS } from '../utils/constants';
import { isMemberActiveInQuarter } from '../utils/initScores';

const TEMPLATE_PATH = path.resolve(__dirname, '../../../../template/【产品研发部党支部】党员积分导出模版.xlsx');
const WORK_SCORE_TEMPLATE_PATH = path.resolve(__dirname, '../../../../template/【产品研发部党支部】党员党务积分导出模版.xlsx');

export const reportController = {
  // 导出党员积分总台账（按模板格式，保留所有样式）
  async exportScoreSummary(req: Request, res: Response) {
    try {
      const { quarterId } = req.query;
      const qid = Number(quarterId);
      if (!quarterId) {
        return res.status(400).json({ code: 400, message: '缺少quarterId参数' });
      }

      const quarter = await prisma.quarter.findUnique({ where: { id: qid } });
      if (!quarter) {
        return res.status(404).json({ code: 404, message: '季度不存在' });
      }

      const isArchived = quarter.isArchived;

      // 使用 exceljs 读取模板（完整保留格式）
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(TEMPLATE_PATH);

      // 获取党员列表（按displayOrder排序，并按转入/转出时间过滤）
      const allMembers = await prisma.partyMember.findMany({
        where: { status: 'active' },
        orderBy: { displayOrder: 'asc' }
      });
      const members = allMembers.filter(m => isMemberActiveInQuarter(m, quarter.startDate));

      // 查询数据（归档季度从快照表读取）
      let scores: any[], roleDetails: any[], bonusRecords: any[], deductionRecords: any[];
      if (isArchived) {
        scores = await prisma.archivedPartyMemberScore.findMany({ where: { quarterId: qid } });
        roleDetails = await prisma.archivedRoleScoreDetail.findMany({ where: { quarterId: qid } });
        bonusRecords = await prisma.archivedBonusRecord.findMany({ where: { quarterId: qid } });
        deductionRecords = await prisma.archivedDeductionRecord.findMany({ where: { quarterId: qid } });
      } else {
        scores = await prisma.partyMemberScore.findMany({
          where: { quarterId: qid },
          include: { partyMember: true }
        });
        roleDetails = await prisma.roleScoreDetail.findMany({ where: { quarterId: qid } });
        bonusRecords = await prisma.bonusRecord.findMany({ where: { quarterId: qid } });
        deductionRecords = await prisma.deductionRecord.findMany({ where: { quarterId: qid } });
      }
      const scoreMap = new Map(scores.map(s => [s.partyMemberId, s]));

      const roleDetailMap = new Map<number, Map<number, any>>();
      roleDetails.forEach(d => {
        if (!roleDetailMap.has(d.partyMemberId)) {
          roleDetailMap.set(d.partyMemberId, new Map());
        }
        roleDetailMap.get(d.partyMemberId)!.set(d.month, d);
      });

      const bonusMap = new Map<number, any[]>();
      bonusRecords.forEach(b => {
        if (!bonusMap.has(b.partyMemberId)) bonusMap.set(b.partyMemberId, []);
        bonusMap.get(b.partyMemberId)!.push(b);
      });

      const deductionMap = new Map<number, any[]>();
      deductionRecords.forEach(d => {
        if (!deductionMap.has(d.partyMemberId)) deductionMap.set(d.partyMemberId, []);
        deductionMap.get(d.partyMemberId)!.push(d);
      });

      const months = QUARTER_MONTHS[quarter.quarter] || [];

      // ===== 1. 积分总台账 =====
      const ws1 = workbook.getWorksheet('积分总台账');
      if (ws1) {
        // 替换标题
        const titleCell = ws1.getCell('A1');
        if (titleCell.value) {
          titleCell.value = (titleCell.value as string).replace('yyyyQ季度', `${quarter.year}Q${quarter.quarter}季度`);
        }

        // 填充数据行（从第4行开始）
        members.forEach((member, index) => {
          const row = index + 4;
          const score = scoreMap.get(member.id);
          ws1.getCell(`A${row}`).value = index + 1;
          ws1.getCell(`B${row}`).value = member.name;
          ws1.getCell(`C${row}`).value = score?.totalScore ?? '';
          ws1.getCell(`D${row}`).value = score?.politicalScore ?? '';
          ws1.getCell(`E${row}`).value = score?.disciplineScore ?? '';
          ws1.getCell(`F${row}`).value = score?.moralityScore ?? '';
          ws1.getCell(`G${row}`).value = score?.performanceScore ?? '';
          ws1.getCell(`H${row}`).value = score?.roleScore ?? '';
          ws1.getCell(`I${row}`).value = score?.bonusScore ?? 0;
          ws1.getCell(`J${row}`).value = score?.deductionScore ?? 0;
          ws1.getCell(`K${row}`).value = score?.vetoStatus === 'none' ? '无' : score?.vetoStatus === 'light' ? '轻度' : '严重';
          ws1.getCell(`L${row}`).value = score?.remark || '';
        });
      }

      // ===== 2. 履职分台账 =====
      const ws2 = workbook.getWorksheet('履职分台账');
      if (ws2) {
        // 替换月份标题
        months.forEach((m, i) => {
          const col = String.fromCharCode(68 + i); // D, E, F
          const cell = ws2.getCell(`${col}5`);
          if (cell.value) {
            cell.value = (cell.value as string).replace('MM月', `${m}月`);
          }
        });

        // 填充数据行（从第6行开始）
        members.forEach((member, index) => {
          const row = index + 6;
          const score = scoreMap.get(member.id);
          const details = roleDetailMap.get(member.id);

          ws2.getCell(`A${row}`).value = index + 1;
          ws2.getCell(`B${row}`).value = member.name;
          ws2.getCell(`C${row}`).value = score?.performanceScore ?? '';

          let monthlyTotalSum = 0;
          let monthCount = 0;
          months.forEach((m, i) => {
            const col = String.fromCharCode(68 + i); // D, E, F
            const detail = details?.get(m);
            let val: any = detail?.monthlyTotal ?? '';
            if (val === '' && detail) {
              val = detail.dim1HardBattle + detail.dim2TechShare + detail.dim3ShuangYou + detail.dim4Culture + detail.dim5ChinaStory;
            }
            ws2.getCell(`${col}${row}`).value = val;
            if (val !== '') {
              monthlyTotalSum += Number(val);
              monthCount++;
            }
          });

          const avg = monthCount > 0 ? Number((monthlyTotalSum / monthCount).toFixed(2)) : '';
          ws2.getCell(`G${row}`).value = avg;
        });
      }

      // ===== 3. 加分台账 =====
      const ws3 = workbook.getWorksheet('加分台账');
      if (ws3) {
        members.forEach((member, index) => {
          const row = index + 3;
          const records = bonusMap.get(member.id) || [];

          const levelScores: Record<number, number> = {};
          records.forEach(r => {
            levelScores[r.level] = (levelScores[r.level] || 0) + r.score;
          });

          const total = records.reduce((sum, r) => sum + r.score, 0);

          ws3.getCell(`A${row}`).value = index + 1;
          ws3.getCell(`B${row}`).value = member.name;
          ws3.getCell(`C${row}`).value = total || '';
          ws3.getCell(`D${row}`).value = levelScores[1] || ''; // 国家级
          ws3.getCell(`E${row}`).value = levelScores[2] || ''; // 省部级
          ws3.getCell(`F${row}`).value = levelScores[3] || ''; // 集团/省委
          ws3.getCell(`G${row}`).value = levelScores[4] || ''; // 市级/省公司
          const hScore = (levelScores[5] || 0) + (levelScores[6] || 0);
          ws3.getCell(`H${row}`).value = hScore || '';
          ws3.getCell(`I${row}`).value = levelScores[7] || ''; // 重大贡献
          // 备注：拼接所有加分记录的 description
          const remarks = records.map(r => r.description).filter(Boolean);
          ws3.getCell(`J${row}`).value = remarks.join('; ') || '';
        });
      }

      // ===== 4. 扣分台账 =====
      const ws4 = workbook.getWorksheet('扣分台账');
      if (ws4) {
        members.forEach((member, index) => {
          const row = index + 3;
          const records = deductionMap.get(member.id) || [];

          const typeScores: Record<number, number> = {};
          records.forEach(r => {
            typeScores[r.type] = (typeScores[r.type] || 0) + r.score;
          });

          const total = records.reduce((sum, r) => sum + r.score, 0);

          ws4.getCell(`A${row}`).value = index + 1;
          ws4.getCell(`B${row}`).value = member.name;
          ws4.getCell(`C${row}`).value = total || '';

          for (let type = 1; type <= 13; type++) {
            const col = String.fromCharCode(68 + type - 1); // D=68, E=69, ...
            const val = typeScores[type] || '';
            ws4.getCell(`${col}${row}`).value = val;
          }
        });
      }

      // 写入响应（保留所有格式）
      const buffer = await workbook.xlsx.writeBuffer();
      const filename = `【产品研发部党支部】${quarter.year}年${quarter.quarter}季度党员积分导出.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.end(Buffer.from(buffer));
    } catch (error: any) {
      console.error('Export error:', error);
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 导出党务积分季度汇总（按模板格式）
  async exportWorkScoreSummary(req: Request, res: Response) {
    try {
      const { quarterId } = req.query;
      const qid = Number(quarterId);
      if (!quarterId) {
        return res.status(400).json({ code: 400, message: '缺少quarterId参数' });
      }

      const quarter = await prisma.quarter.findUnique({ where: { id: qid } });
      if (!quarter) {
        return res.status(404).json({ code: 404, message: '季度不存在' });
      }

      const isArchived = quarter.isArchived;

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(WORK_SCORE_TEMPLATE_PATH);

      const allMembers = await prisma.partyMember.findMany({
        where: { status: 'active' },
        orderBy: { displayOrder: 'asc' }
      });
      const members = allMembers.filter(m => isMemberActiveInQuarter(m, quarter.startDate));

      const workScores = isArchived
        ? await prisma.archivedPartyWorkScore.findMany({ where: { quarterId: qid } })
        : await prisma.partyWorkScore.findMany({ where: { quarterId: qid } });

      const ws = workbook.getWorksheet('季度汇总');
      if (ws) {
        // 替换季度标题 D2:J2
        const titleCell = ws.getCell('D2');
        if (titleCell.value) {
          titleCell.value = (titleCell.value as string).replace('yyyy年Q', `${quarter.year}年Q${quarter.quarter}`);
        }

        // 填充数据行（从第4行开始）
        members.forEach((member, index) => {
          const row = index + 4;
          const memberScores = workScores.filter(s => s.partyMemberId === member.id);
          const positions = JSON.parse(member.partyPositions || '[]');

          const quarterBaseScore = 95;
          const quarterBaseBonus = memberScores.reduce((sum, s) => sum + s.baseBonus, 0);
          const quarterTaskBonus = memberScores.reduce((sum, s) => sum + s.taskBonus, 0);
          const quarterDeduction = memberScores.reduce((sum, s) => sum + s.deduction, 0);
          const quarterTotal = quarterBaseScore + quarterBaseBonus + quarterTaskBonus - quarterDeduction;
          const totalBonus = quarterBaseBonus + quarterTaskBonus;

          // 职务显示
          const positionParts: string[] = [];
          if (positions.length > 0) positionParts.push(positions.join(','));
          if (member.isPartyWorker) positionParts.push('党务工作者');

          ws.getCell(`A${row}`).value = index + 1;
          ws.getCell(`B${row}`).value = member.name;
          ws.getCell(`C${row}`).value = positionParts.length > 0 ? positionParts.join('/') : '-';
          ws.getCell(`D${row}`).value = quarterBaseScore;
          ws.getCell(`E${row}`).value = quarterBaseBonus || '';
          ws.getCell(`F${row}`).value = quarterTaskBonus || '';
          ws.getCell(`G${row}`).value = quarterDeduction || '';
          ws.getCell(`H${row}`).value = quarterTotal;
          ws.getCell(`I${row}`).value = totalBonus || '';
        });

        // 计算归一化5分（需要在所有行填充完后）
        const maxBonus = Math.max(...members.map((member) => {
          const memberScores = workScores.filter(s => s.partyMemberId === member.id);
          const quarterBaseBonus = memberScores.reduce((sum, s) => sum + s.baseBonus, 0);
          const quarterTaskBonus = memberScores.reduce((sum, s) => sum + s.taskBonus, 0);
          return quarterBaseBonus + quarterTaskBonus;
        }), 1);

        members.forEach((member, index) => {
          const row = index + 4;
          const memberScores = workScores.filter(s => s.partyMemberId === member.id);
          const totalBonus = memberScores.reduce((sum, s) => sum + s.baseBonus + s.taskBonus, 0);
          const normalizedScore = Number(((totalBonus / maxBonus) * 5).toFixed(2));
          ws.getCell(`J${row}`).value = normalizedScore;
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const filename = `【产品研发部党支部】${quarter.year}年${quarter.quarter}季度党员党务积分导出.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.end(Buffer.from(buffer));
    } catch (error: any) {
      console.error('Export work score error:', error);
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 导出公示版积分表
  async exportPublicScore(req: Request, res: Response) {
    try {
      const { quarterId, type } = req.query;
      const qid = Number(quarterId);
      if (!quarterId) {
        return res.status(400).json({ code: 400, message: '缺少quarterId参数' });
      }

      const quarter = await prisma.quarter.findUnique({ where: { id: qid } });
      const isArchived = quarter?.isArchived ?? false;

      const members = await prisma.partyMember.findMany({
        where: { status: 'active' },
        orderBy: { displayOrder: 'asc' }
      });

      let data: any[] = [];

      if (type === 'work_score') {
        const workScores = isArchived
          ? await prisma.archivedPartyWorkScore.findMany({ where: { quarterId: qid } })
          : await prisma.partyWorkScore.findMany({ where: { quarterId: qid } });

        const memberMap = new Map();
        workScores.forEach(s => {
          if (!memberMap.has(s.partyMemberId)) {
            memberMap.set(s.partyMemberId, { baseBonus: 0, taskBonus: 0, deduction: 0 });
          }
          const m = memberMap.get(s.partyMemberId);
          m.baseBonus += s.baseBonus;
          m.taskBonus += s.taskBonus;
          m.deduction += s.deduction;
        });

        data = members.map((member, index) => {
          const m = memberMap.get(member.id);
          const quarterTotal = m ? (95 + m.baseBonus + m.taskBonus - m.deduction) : 95;
          return {
            '序号': index + 1,
            '党员姓名': member.name,
            '党务加分（季度小计）': quarterTotal,
            '备注': ''
          };
        });
      } else {
        const scores = isArchived
          ? await prisma.archivedPartyMemberScore.findMany({ where: { quarterId: qid } })
          : await prisma.partyMemberScore.findMany({ where: { quarterId: qid } });

        const scoreMap = new Map(scores.map(s => [s.partyMemberId, s]));

        data = members.map((member, index) => {
          const score = scoreMap.get(member.id);
          return {
            '序号': index + 1,
            '党员姓名': member.name,
            '党员积分（100分制）': score ? (score.totalScore ?? '-') : '-',
            '备注': ''
          };
        });
      }

      // 公示版用简单导出即可
      const XLSX = require('xlsx');
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, type === 'work_score' ? '党务加分公示' : '党员积分公示');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const filename = type === 'work_score' ? '党务加分公示版.xlsx' : '党员积分公示版.xlsx';

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.end(buffer);
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  }
};
