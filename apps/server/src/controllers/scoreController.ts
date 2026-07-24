import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import scoreCalculationService from '../services/ScoreCalculationService';
import { isMemberActiveInQuarter } from '../utils/initScores';
import { checkQuarterArchived } from './quarterController';

export const scoreController = {
  // 获取积分总台账（归档季度从快照表读取）
  async getScores(req: Request, res: Response) {
    try {
      const { quarterId } = req.query;
      
      if (!quarterId) {
        return res.status(400).json({ code: 400, message: '缺少quarterId参数' });
      }

      const quarter = await prisma.quarter.findUnique({
        where: { id: Number(quarterId) }
      });

      const isArchived = quarter?.isArchived ?? false;
      const qid = Number(quarterId);

      let scores: any[];
      if (isArchived) {
        // 从归档快照表读取，需要关联党员信息
        const archived = await prisma.archivedPartyMemberScore.findMany({
          where: { quarterId: qid },
          orderBy: { partyMemberId: 'asc' }
        });
        const members = await prisma.partyMember.findMany();
        scores = archived.map(a => ({
          ...a,
          partyMember: members.find(m => m.id === a.partyMemberId) || null
        }));
      } else {
        scores = await prisma.partyMemberScore.findMany({
          where: { quarterId: qid },
          include: { partyMember: true },
          orderBy: { partyMember: { displayOrder: 'asc' } }
        });
      }

      // 按转入/转出时间过滤
      if (quarter) {
        scores = scores.filter(s => isMemberActiveInQuarter(s.partyMember, quarter.startDate));
      }

      res.json({ code: 200, data: scores });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 获取单个党员积分详情（归档季度从快照表读取）
  async getMemberScore(req: Request, res: Response) {
    try {
      const { memberId, quarterId } = req.params;
      const mid = Number(memberId);
      const qid = Number(quarterId);

      const quarter = await prisma.quarter.findUnique({ where: { id: qid } });
      const isArchived = quarter?.isArchived ?? false;

      let score: any;
      let roleDetails: any[];
      let bonusRecords: any[];
      let deductionRecords: any[];

      if (isArchived) {
        score = await prisma.archivedPartyMemberScore.findUnique({
          where: { partyMemberId_quarterId: { partyMemberId: mid, quarterId: qid } }
        });
        if (score) {
          score.partyMember = await prisma.partyMember.findUnique({ where: { id: mid } });
        }
        roleDetails = await prisma.archivedRoleScoreDetail.findMany({
          where: { partyMemberId: mid, quarterId: qid },
          orderBy: [{ year: 'asc' }, { month: 'asc' }]
        });
        bonusRecords = await prisma.archivedBonusRecord.findMany({
          where: { partyMemberId: mid, quarterId: qid }
        });
        deductionRecords = await prisma.archivedDeductionRecord.findMany({
          where: { partyMemberId: mid, quarterId: qid }
        });
      } else {
        score = await prisma.partyMemberScore.findUnique({
          where: { partyMemberId_quarterId: { partyMemberId: mid, quarterId: qid } },
          include: { partyMember: true }
        });
        roleDetails = await prisma.roleScoreDetail.findMany({
          where: { partyMemberId: mid, quarterId: qid },
          orderBy: [{ year: 'asc' }, { month: 'asc' }]
        });
        bonusRecords = await prisma.bonusRecord.findMany({
          where: { partyMemberId: mid, quarterId: qid }
        });
        deductionRecords = await prisma.deductionRecord.findMany({
          where: { partyMemberId: mid, quarterId: qid }
        });
      }

      if (!score) {
        return res.status(404).json({ code: 404, message: '积分记录不存在' });
      }

      res.json({
        code: 200,
        data: { score, roleDetails, bonusRecords, deductionRecords }
      });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 更新绩效等级
  async updatePerformance(req: Request, res: Response) {
    try {
      const { memberId, quarterId } = req.params;
      const qid = Number(quarterId);
      if (await checkQuarterArchived(qid)) {
        return res.status(403).json({ code: 403, message: '该季度已归档，不允许修改' });
      }
      const { performanceLevel } = req.body;

      await prisma.partyMemberScore.update({
        where: {
          partyMemberId_quarterId: {
            partyMemberId: Number(memberId),
            quarterId: Number(quarterId)
          }
        },
        data: { performanceLevel }
      });

      // 重新计算积分
      const result = await scoreCalculationService.calculateAndSaveMemberScore(
        Number(memberId),
        Number(quarterId)
      );

      res.json({ code: 200, data: result });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 更新基础分
  async updateBasicScore(req: Request, res: Response) {
    try {
      const { memberId, quarterId } = req.params;
      const qid = Number(quarterId);
      if (await checkQuarterArchived(qid)) {
        return res.status(403).json({ code: 403, message: '该季度已归档，不允许修改' });
      }
      const { politicalScore, disciplineScore, moralityScore } = req.body;

      await prisma.partyMemberScore.update({
        where: {
          partyMemberId_quarterId: {
            partyMemberId: Number(memberId),
            quarterId: Number(quarterId)
          }
        },
        data: {
          politicalScore,
          disciplineScore,
          moralityScore
        }
      });

      const result = await scoreCalculationService.calculateAndSaveMemberScore(
        Number(memberId),
        Number(quarterId)
      );

      res.json({ code: 200, data: result });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 更新一票否决
  async updateVeto(req: Request, res: Response) {
    try {
      const { memberId, quarterId } = req.params;
      const qid = Number(quarterId);
      if (await checkQuarterArchived(qid)) {
        return res.status(403).json({ code: 403, message: '该季度已归档，不允许修改' });
      }
      const { vetoStatus } = req.body;

      await prisma.partyMemberScore.update({
        where: {
          partyMemberId_quarterId: {
            partyMemberId: Number(memberId),
            quarterId: Number(quarterId)
          }
        },
        data: { vetoStatus }
      });

      const result = await scoreCalculationService.calculateAndSaveMemberScore(
        Number(memberId),
        Number(quarterId)
      );

      res.json({ code: 200, data: result });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 重新计算季度积分
  async recalculateScores(req: Request, res: Response) {
    try {
      const { quarterId } = req.params;
      const qid = Number(quarterId);
      if (await checkQuarterArchived(qid)) {
        return res.status(403).json({ code: 403, message: '该季度已归档，不允许重新计算' });
      }
      const result = await scoreCalculationService.recalculateQuarterScores(qid);
      res.json({ code: 200, message: '计算完成', data: result });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 获取履职分明细（归档季度从快照表读取）
  async getRoleScores(req: Request, res: Response) {
    try {
      const { memberId, quarterId } = req.params;
      const mid = Number(memberId);
      const qid = Number(quarterId);

      const quarter = await prisma.quarter.findUnique({ where: { id: qid } });
      const isArchived = quarter?.isArchived ?? false;

      const details = isArchived
        ? await prisma.archivedRoleScoreDetail.findMany({
            where: { partyMemberId: mid, quarterId: qid },
            orderBy: [{ year: 'asc' }, { month: 'asc' }]
          })
        : await prisma.roleScoreDetail.findMany({
            where: { partyMemberId: mid, quarterId: qid },
            orderBy: [{ year: 'asc' }, { month: 'asc' }]
          });

      res.json({ code: 200, data: details });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 更新履职分明细
  async updateRoleScore(req: Request, res: Response) {
    try {
      const { detailId } = req.params;
      const data = req.body;

      // 先查出 detail 对应的 quarterId 检查是否归档
      const existing = await prisma.roleScoreDetail.findUnique({ where: { id: Number(detailId) } });
      if (existing && await checkQuarterArchived(existing.quarterId)) {
        return res.status(403).json({ code: 403, message: '该季度已归档，不允许修改' });
      }

      const detail = await prisma.roleScoreDetail.update({
        where: { id: Number(detailId) },
        data: {
          dim1HardBattle: data.dim1HardBattle,
          dim2TechShare: data.dim2TechShare,
          dim3ShuangYou: data.dim3ShuangYou,
          dim4Culture: data.dim4Culture,
          dim5ChinaStory: data.dim5ChinaStory,
          isHardBattleLeader: data.isHardBattleLeader,
          isShuangYou: data.isShuangYou,
          isTeamLeader: data.isTeamLeader,
          cultureBaseScore: data.cultureBaseScore,
          remark: data.remark
        }
      });

      // 重新计算该党员积分
      await scoreCalculationService.calculateAndSaveMemberScore(
        detail.partyMemberId,
        detail.quarterId
      );

      res.json({ code: 200, data: detail });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 生成党员积分公示PDF（自包含，无需服务器）
  async exportPublicScorePdf(req: Request, res: Response) {
    try {
      const { quarterId } = req.params;
      const qid = Number(quarterId);

      const quarter = await prisma.quarter.findUnique({ where: { id: qid } });
      if (!quarter) {
        return res.status(404).json({ code: 404, message: '季度不存在' });
      }

      const isArchived = quarter.isArchived;

      let scores: any[];
      if (isArchived) {
        const archived = await prisma.archivedPartyMemberScore.findMany({
          where: { quarterId: qid },
          orderBy: { partyMemberId: 'asc' }
        });
        const members = await prisma.partyMember.findMany();
        scores = archived.map(a => ({
          ...a,
          partyMember: members.find(m => m.id === a.partyMemberId) || null
        }));
      } else {
        scores = await prisma.partyMemberScore.findMany({
          where: { quarterId: qid },
          include: { partyMember: true },
          orderBy: { partyMember: { displayOrder: 'asc' } }
        });
      }

      scores = scores.filter(s => isMemberActiveInQuarter(s.partyMember, quarter.startDate));

      const startDateStr = quarter.startDate.toISOString().slice(0, 10);
      const endDateStr = quarter.endDate.toISOString().slice(0, 10);
      const html = buildScoreShareHtml(quarter, startDateStr, endDateStr, scores);

      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
      });
      await browser.close();

      const filename = `党员积分公示_${quarter.year}年Q${quarter.quarter}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.end(pdfBuffer);
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  }
};

function buildScoreShareHtml(quarter: any, startDateStr: string, endDateStr: string, scores: any[]): string {
  const getVetoText = (status: string) => {
    switch (status) {
      case 'light': return '<span style="color:#fa8c16;font-weight:bold">轻度否决</span>';
      case 'severe': return '<span style="color:#f5222d;font-weight:bold">严重否决</span>';
      default: return '<span style="color:#52c41a">无</span>';
    }
  };

  const rows = scores.map((s, index) => `
    <tr>
      <td style="padding:8px;border:1px solid #ddd;text-align:center">${index + 1}</td>
      <td style="padding:8px;border:1px solid #ddd">${s.partyMember.name}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center">${s.politicalScore}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center">${s.disciplineScore}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center">${s.moralityScore}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center">${s.performanceLevel || '-'}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center">${s.performanceScore ?? '-'}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center">${s.roleScore ?? '-'}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center;color:#52c41a;font-weight:bold">${s.bonusScore > 0 ? '+' + s.bonusScore : '-'}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center;color:#f5222d;font-weight:bold">${s.deductionScore > 0 ? '-' + s.deductionScore : '-'}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center">${getVetoText(s.vetoStatus)}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center;font-weight:bold;color:#cf1322;font-size:15px">${s.totalScore ?? '-'}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>党员积分公示 - ${quarter.year}年Q${quarter.quarter}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; background:#f5f5f5; color:#333; line-height:1.6; }
  .container { max-width:1200px; margin:0 auto; padding:24px 16px; }
  .header { text-align:center; margin-bottom:24px; }
  .header h1 { color:#cf1322; font-size:22px; margin-bottom:4px; }
  .header .subtitle { color:#999; font-size:14px; }
  .notice { background:#e6f7ff; border:1px solid #91d5ff; border-radius:4px; padding:12px 16px; margin-bottom:16px; font-size:13px; color:#096dd9; }
  .section-title { font-size:16px; font-weight:bold; margin:24px 0 12px; padding-bottom:8px; border-bottom:2px solid #cf1322; color:#333; }
  table { width:100%; border-collapse:collapse; background:#fff; font-size:12px; }
  th { background:#fafafa; padding:8px 6px; border:1px solid #ddd; text-align:center; font-weight:600; color:#666; white-space:nowrap; }
  tr:hover { background:#f5f5f5; }
  .footer { text-align:center; margin-top:32px; color:#999; font-size:12px; }
  .legend { font-size:12px; color:#666; text-align:right; margin-top:8px; line-height:1.8; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>产品研发部党支部 党员积分公示</h1>
    <div class="subtitle">${quarter.year}年 第${quarter.quarter}季度（${startDateStr} ~ ${endDateStr}）</div>
  </div>
  <div class="notice">本页面为党员积分季度汇总公示，数据为当季快照，仅供查阅。</div>
  <div class="section-title">积分汇总</div>
  <table>
    <thead>
      <tr>
        <th style="width:40px">序号</th>
        <th style="width:70px">姓名</th>
        <th style="width:60px">政治</th>
        <th style="width:60px">纪律</th>
        <th style="width:60px">品德</th>
        <th style="width:60px">绩效</th>
        <th style="width:50px">绩效分</th>
        <th style="width:60px">履职</th>
        <th style="width:50px">加分</th>
        <th style="width:50px">扣分</th>
        <th style="width:60px">否决</th>
        <th style="width:55px">总分</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <div class="legend">
    基础分60分（政治合格20 + 执行纪律20 + 品德合格20）+ 履职分40分（绩效等级 + 发挥作用）+ 加分 - 扣分；<br>
    一票否决：轻度否决扣20分，严重否决直接取消资格。
  </div>
  <div class="footer">
    产品研发部党支部 · 党员党务积分助手 · 生成于 ${new Date().toLocaleString('zh-CN')}
  </div>
</div>
</body>
</html>`;
}
