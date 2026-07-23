import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { isMemberActiveInQuarter } from '../utils/initScores';
import { checkQuarterArchived } from './quarterController';

export const workScoreController = {
  // 获取党务加分月度列表（归档季度从快照表读取）
  async getWorkScores(req: Request, res: Response) {
    try {
      const { quarterId, year, month } = req.query;
      const qid = Number(quarterId);
      
      if (!quarterId) {
        return res.status(400).json({ code: 400, message: '缺少quarterId参数' });
      }

      const quarter = await prisma.quarter.findUnique({ where: { id: qid } });
      const isArchived = quarter?.isArchived ?? false;

      const where: any = { quarterId: qid };
      if (year) where.year = Number(year);
      if (month) where.month = Number(month);

      let scores: any[];
      if (isArchived) {
        scores = await prisma.archivedPartyWorkScore.findMany({
          where,
          orderBy: [{ year: 'asc' }, { month: 'asc' }]
        });
        const members = await prisma.partyMember.findMany();
        scores = scores.map(s => ({
          ...s,
          partyMember: members.find(m => m.id === s.partyMemberId) || null
        }));
      } else {
        scores = await prisma.partyWorkScore.findMany({
          where,
          include: { partyMember: true },
          orderBy: [
            { partyMember: { displayOrder: 'asc' } },
            { year: 'asc' },
            { month: 'asc' }
          ]
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

  // 获取党务加分季度汇总（归档季度从快照表读取）
  async getWorkScoreSummary(req: Request, res: Response) {
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

      const allMembers = await prisma.partyMember.findMany({
        where: { status: 'active' },
        orderBy: { displayOrder: 'asc' }
      });

      // 按转入/转出时间过滤
      const members = allMembers.filter(m => isMemberActiveInQuarter(m, quarter.startDate));

      const isArchived = quarter.isArchived;
      const workScores = isArchived
        ? await prisma.archivedPartyWorkScore.findMany({ where: { quarterId: qid } })
        : await prisma.partyWorkScore.findMany({ where: { quarterId: qid } });

      // 按党员分组计算季度汇总
      const results = members.map((member, index) => {
        const memberScores = workScores.filter(s => s.partyMemberId === member.id);
        const positions = JSON.parse(member.partyPositions || '[]');
        
        const quarterBaseScore = 95;
        const quarterBaseBonus = memberScores.reduce((sum, s) => sum + s.baseBonus, 0);
        const quarterTaskBonus = memberScores.reduce((sum, s) => sum + s.taskBonus, 0);
        const quarterDeduction = memberScores.reduce((sum, s) => sum + s.deduction, 0);
        const quarterTotal = quarterBaseScore + quarterBaseBonus + quarterTaskBonus - quarterDeduction;
        const totalBonus = quarterBaseBonus + quarterTaskBonus;

        return {
          index: index + 1,
          member,
          quarterBaseScore,
          quarterBaseBonus,
          quarterTaskBonus,
          quarterDeduction,
          quarterTotal,
          totalBonus
        };
      });

      // 计算归一化为5分
      const maxBonus = Math.max(...results.map(r => r.totalBonus), 1);
      results.forEach(r => {
        (r as any).normalizedScore = Number(((r.totalBonus / maxBonus) * 5).toFixed(2));
      });

      res.json({ code: 200, data: { quarter, results } });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 更新党务加分
  async updateWorkScore(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { baseBonus, taskBonus, deduction } = req.body;

      // 查出对应的 quarterId 检查是否归档
      const existing = await prisma.partyWorkScore.findUnique({ where: { id: Number(id) } });
      if (existing && await checkQuarterArchived(existing.quarterId)) {
        return res.status(403).json({ code: 403, message: '该季度已归档，不允许修改' });
      }

      const score = await prisma.partyWorkScore.update({
        where: { id: Number(id) },
        data: {
          baseBonus: baseBonus ?? undefined,
          taskBonus: taskBonus ?? undefined,
          deduction: deduction ?? undefined
        }
      });

      // 重新计算月度小计
      const updated = await prisma.partyWorkScore.update({
        where: { id: score.id },
        data: {
          monthlyTotal: score.baseScore + (baseBonus ?? score.baseBonus) + (taskBonus ?? score.taskBonus) - (deduction ?? score.deduction)
        }
      });

      res.json({ code: 200, data: updated });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 重新计算党务加分基础加分（当党员职务变更时调用）
  async recalculateBaseBonus(req: Request, res: Response) {
    try {
      const { quarterId } = req.query;
      if (!quarterId) {
        return res.status(400).json({ code: 400, message: '缺少quarterId参数' });
      }

      if (await checkQuarterArchived(Number(quarterId))) {
        return res.status(403).json({ code: 403, message: '该季度已归档，不允许重新计算' });
      }

      const quarter = await prisma.quarter.findUnique({
        where: { id: Number(quarterId) }
      });
      if (!quarter) {
        return res.status(404).json({ code: 404, message: '季度不存在' });
      }

      const quarterMonths: Record<number, number[]> = {
        1: [1, 2, 3], 2: [4, 5, 6], 3: [7, 8, 9], 4: [10, 11, 12]
      };
      const months = quarterMonths[quarter.quarter] || [];
      const firstMonth = months[0];

      const allMembers = await prisma.partyMember.findMany({
        where: { status: 'active' }
      });

      // 按转入/转出时间过滤
      const members = allMembers.filter(m => isMemberActiveInQuarter(m, quarter.startDate));

      let updatedCount = 0;
      for (const member of members) {
        const positions = JSON.parse(member.partyPositions || '[]');
        const isBranchCommittee = positions.length > 0;
        const baseBonus = isBranchCommittee ? 5 : (member.isPartyWorker ? 3 : 0);

        for (const month of months) {
          const monthBaseBonus = (month === firstMonth) ? baseBonus : 0;
          
          const workScore = await prisma.partyWorkScore.findFirst({
            where: {
              partyMemberId: member.id,
              quarterId: Number(quarterId),
              year: quarter.year,
              month
            }
          });

          if (workScore) {
            await prisma.partyWorkScore.update({
              where: { id: workScore.id },
              data: {
                baseBonus: monthBaseBonus,
                monthlyTotal: 95 + monthBaseBonus + workScore.taskBonus - workScore.deduction
              }
            });
            updatedCount++;
          }
        }
      }

      res.json({ code: 200, message: `已重新计算 ${updatedCount} 条记录的基础加分` });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 获取党务加分明细（归档季度从快照表读取）
  async getWorkScoreDetails(req: Request, res: Response) {
    try {
      const { quarterId, year, month } = req.query;
      const qid = quarterId ? Number(quarterId) : null;

      let isArchived = false;
      if (qid) {
        const quarter = await prisma.quarter.findUnique({ where: { id: qid } });
        isArchived = quarter?.isArchived ?? false;
      }

      const where: any = {};
      if (qid) where.quarterId = qid;
      if (year) where.year = Number(year);
      if (month) where.month = Number(month);

      let details: any[];
      if (isArchived) {
        details = await prisma.archivedPartyWorkBonusDetail.findMany({
          where,
          orderBy: [{ year: 'asc' }, { month: 'asc' }]
        });
        const members = await prisma.partyMember.findMany();
        details = details.map(d => ({
          ...d,
          partyMember: members.find(m => m.id === d.partyMemberId) || null
        }));
      } else {
        details = await prisma.partyWorkBonusDetail.findMany({
          where,
          include: { partyMember: true },
          orderBy: [
            { partyMember: { displayOrder: 'asc' } },
            { year: 'asc' },
            { month: 'asc' }
          ]
        });
      }

      res.json({ code: 200, data: details });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 创建党务加分明细
  async createWorkScoreDetail(req: Request, res: Response) {
    try {
      const data = req.body;
      if (await checkQuarterArchived(data.quarterId)) {
        return res.status(403).json({ code: 403, message: '该季度已归档，不允许添加' });
      }

      const detail = await prisma.partyWorkBonusDetail.create({
        data: {
          partyMemberId: data.partyMemberId,
          quarterId: data.quarterId,
          year: data.year,
          month: data.month,
          type: data.type,
          content: data.content,
          score: data.score
        }
      });

      // 更新对应的月度总分
      const workScore = await prisma.partyWorkScore.findFirst({
        where: {
          partyMemberId: data.partyMemberId,
          quarterId: data.quarterId,
          year: data.year,
          month: data.month
        }
      });

      if (workScore) {
        const details = await prisma.partyWorkBonusDetail.findMany({
          where: {
            partyMemberId: data.partyMemberId,
            quarterId: data.quarterId,
            year: data.year,
            month: data.month
          }
        });
        const totalTaskBonus = details.reduce((sum, d) => sum + d.score, 0);
        
        await prisma.partyWorkScore.update({
          where: { id: workScore.id },
          data: {
            taskBonus: totalTaskBonus,
            monthlyTotal: workScore.baseScore + workScore.baseBonus + totalTaskBonus - workScore.deduction
          }
        });
      }

      res.json({ code: 200, data: detail });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 删除党务加分明细
  async deleteWorkScoreDetail(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const detail = await prisma.partyWorkBonusDetail.findUnique({
        where: { id: Number(id) }
      });

      if (detail && await checkQuarterArchived(detail.quarterId)) {
        return res.status(403).json({ code: 403, message: '该季度已归档，不允许删除' });
      }

      if (!detail) {
        return res.status(404).json({ code: 404, message: '记录不存在' });
      }

      await prisma.partyWorkBonusDetail.delete({
        where: { id: Number(id) }
      });

      if (!detail) {
        return res.status(404).json({ code: 404, message: '记录不存在' });
      }

      await prisma.partyWorkBonusDetail.delete({
        where: { id: Number(id) }
      });

      // 重新计算月度任务加分
      const workScore = await prisma.partyWorkScore.findFirst({
        where: {
          partyMemberId: detail.partyMemberId,
          quarterId: detail.quarterId,
          year: detail.year,
          month: detail.month
        }
      });

      if (workScore) {
        const details = await prisma.partyWorkBonusDetail.findMany({
          where: {
            partyMemberId: detail.partyMemberId,
            quarterId: detail.quarterId,
            year: detail.year,
            month: detail.month
          }
        });
        const totalTaskBonus = details.reduce((sum, d) => sum + d.score, 0);
        
        await prisma.partyWorkScore.update({
          where: { id: workScore.id },
          data: {
            taskBonus: totalTaskBonus,
            monthlyTotal: workScore.baseScore + workScore.baseBonus + totalTaskBonus - workScore.deduction
          }
        });
      }

      res.json({ code: 200, message: '删除成功' });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 公开接口：获取党务积分季度汇总（无需认证，只读）
  async getPublicWorkScores(req: Request, res: Response) {
    try {
      const { quarterId } = req.params;
      const qid = Number(quarterId);

      const quarter = await prisma.quarter.findUnique({ where: { id: qid } });
      if (!quarter) {
        return res.status(404).json({ code: 404, message: '季度不存在' });
      }

      const allMembers = await prisma.partyMember.findMany({
        where: { status: 'active' },
        orderBy: { displayOrder: 'asc' }
      });

      // 按转入/转出时间过滤
      const members = allMembers.filter(m => isMemberActiveInQuarter(m, quarter.startDate));

      const isArchived = quarter.isArchived;
      const workScores = isArchived
        ? await prisma.archivedPartyWorkScore.findMany({ where: { quarterId: qid } })
        : await prisma.partyWorkScore.findMany({ where: { quarterId: qid } });

      // 按党员分组计算季度汇总
      const results = members.map((member, index) => {
        const memberScores = workScores.filter(s => s.partyMemberId === member.id);
        const positions = JSON.parse(member.partyPositions || '[]');
        
        const quarterBaseScore = 95;
        const quarterBaseBonus = memberScores.reduce((sum, s) => sum + s.baseBonus, 0);
        const quarterTaskBonus = memberScores.reduce((sum, s) => sum + s.taskBonus, 0);
        const quarterDeduction = memberScores.reduce((sum, s) => sum + s.deduction, 0);
        const quarterTotal = quarterBaseScore + quarterBaseBonus + quarterTaskBonus - quarterDeduction;
        const totalBonus = quarterBaseBonus + quarterTaskBonus;

        return {
          index: index + 1,
          member,
          quarterBaseScore,
          quarterBaseBonus,
          quarterTaskBonus,
          quarterDeduction,
          quarterTotal,
          totalBonus
        };
      });

      // 计算归一化为5分
      const maxBonus = Math.max(...results.map(r => r.totalBonus), 1);
      results.forEach(r => {
        (r as any).normalizedScore = Number(((r.totalBonus / maxBonus) * 5).toFixed(2));
      });

      // 加分明细
      const bonusDetails = isArchived
        ? await prisma.archivedPartyWorkBonusDetail.findMany({ where: { quarterId: qid }, orderBy: [{ year: 'asc' }, { month: 'asc' }] })
        : await prisma.partyWorkBonusDetail.findMany({ where: { quarterId: qid }, orderBy: [{ year: 'asc' }, { month: 'asc' }] });

      res.json({
        code: 200,
        data: {
          quarter,
          results,
          bonusDetails
        }
      });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 生成自包含静态HTML分享页（双击即可打开，无需服务器）
  async exportPublicWorkScoreHtml(req: Request, res: Response) {
    try {
      const { quarterId } = req.params;
      const qid = Number(quarterId);

      const quarter = await prisma.quarter.findUnique({ where: { id: qid } });
      if (!quarter) {
        return res.status(404).json({ code: 404, message: '季度不存在' });
      }

      const allMembers = await prisma.partyMember.findMany({
        where: { status: 'active' },
        orderBy: { displayOrder: 'asc' }
      });

      const members = allMembers.filter(m => isMemberActiveInQuarter(m, quarter.startDate));

      const isArchived = quarter.isArchived;
      const workScores = isArchived
        ? await prisma.archivedPartyWorkScore.findMany({ where: { quarterId: qid } })
        : await prisma.partyWorkScore.findMany({ where: { quarterId: qid } });

      const results = members.map((member, index) => {
        const memberScores = workScores.filter(s => s.partyMemberId === member.id);
        const positions = JSON.parse(member.partyPositions || '[]');
        const quarterBaseScore = 95;
        const quarterBaseBonus = memberScores.reduce((sum, s) => sum + s.baseBonus, 0);
        const quarterTaskBonus = memberScores.reduce((sum, s) => sum + s.taskBonus, 0);
        const quarterDeduction = memberScores.reduce((sum, s) => sum + s.deduction, 0);
        const quarterTotal = quarterBaseScore + quarterBaseBonus + quarterTaskBonus - quarterDeduction;
        const totalBonus = quarterBaseBonus + quarterTaskBonus;
        return {
          index: index + 1,
          member,
          quarterBaseScore,
          quarterBaseBonus,
          quarterTaskBonus,
          quarterDeduction,
          quarterTotal,
          totalBonus
        };
      });

      const maxBonus = Math.max(...results.map(r => r.totalBonus), 1);
      results.forEach((r: any) => {
        r.normalizedScore = Number(((r.totalBonus / maxBonus) * 5).toFixed(2));
      });

      const bonusDetails = isArchived
        ? await prisma.archivedPartyWorkBonusDetail.findMany({ where: { quarterId: qid }, orderBy: [{ year: 'asc' }, { month: 'asc' }] })
        : await prisma.partyWorkBonusDetail.findMany({ where: { quarterId: qid }, orderBy: [{ year: 'asc' }, { month: 'asc' }] });

      // 构建HTML（自包含，所有样式内联，数据内嵌）
      const startDateStr = quarter.startDate.toISOString().slice(0, 10);
      const endDateStr = quarter.endDate.toISOString().slice(0, 10);
      const html = buildShareHtml(quarter, startDateStr, endDateStr, results, bonusDetails);

      const filename = `党务积分公示_${quarter.year}年Q${quarter.quarter}.html`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.send(html);
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  }
};

// 自包含HTML构建函数
function buildShareHtml(quarter: any, startDateStr: string, endDateStr: string, results: any[], bonusDetails: any[]): string {
  const getPositionsText = (member: any) => {
    const positions = JSON.parse(member.partyPositions || '[]');
    const parts: string[] = [];
    if (positions.length > 0) parts.push(positions.join(','));
    if (member.isPartyWorker) parts.push('党务工作者');
    return parts.length > 0 ? parts.join('、') : '-';
  };

  // 汇总表格行
  const summaryRows = results.map(r => `
    <tr>
      <td style="padding:8px;border:1px solid #ddd;text-align:center">${r.index}</td>
      <td style="padding:8px;border:1px solid #ddd">${r.member.name}</td>
      <td style="padding:8px;border:1px solid #ddd;font-size:12px;color:#666">${getPositionsText(r.member)}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center">${r.quarterBaseScore}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center">${r.quarterBaseBonus || ''}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center">${r.quarterTaskBonus || ''}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center">${r.quarterDeduction || ''}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center;font-weight:bold;color:#1890ff">${r.quarterTotal}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center">${r.totalBonus || ''}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center"><span style="background:#1890ff;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px">${r.normalizedScore}</span></td>
    </tr>
  `).join('');

  // 明细表格行
  const detailRows = bonusDetails.map(d => {
    const member = results.find((r: any) => r.member.id === d.partyMemberId)?.member;
    return `
    <tr>
      <td style="padding:8px;border:1px solid #ddd">${member?.name || '-'}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center">${d.year}年${d.month}月</td>
      <td style="padding:8px;border:1px solid #ddd">${d.type}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center;color:#52c41a;font-weight:bold">+${d.score}</td>
      <td style="padding:8px;border:1px solid #ddd;color:#666">${d.content || '-'}</td>
    </tr>
    `;
  }).join('');

  const hasDetails = bonusDetails.length > 0;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>党务积分公示 - ${quarter.year}年Q${quarter.quarter}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; background:#f5f5f5; color:#333; line-height:1.6; }
  .container { max-width:1200px; margin:0 auto; padding:24px 16px; }
  .header { text-align:center; margin-bottom:24px; }
  .header h1 { color:#cf1322; font-size:24px; margin-bottom:4px; }
  .header .subtitle { color:#999; font-size:14px; }
  .notice { background:#e6f7ff; border:1px solid #91d5ff; border-radius:4px; padding:12px 16px; margin-bottom:16px; font-size:13px; color:#096dd9; }
  .section-title { font-size:16px; font-weight:bold; margin:24px 0 12px; padding-bottom:8px; border-bottom:2px solid #cf1322; color:#333; }
  table { width:100%; border-collapse:collapse; background:#fff; font-size:13px; }
  th { background:#fafafa; padding:10px 8px; border:1px solid #ddd; text-align:center; font-weight:600; color:#666; white-space:nowrap; }
  tr:hover { background:#f5f5f5; }
  .footer { text-align:center; margin-top:32px; color:#999; font-size:12px; }
  .legend { font-size:12px; color:#666; text-align:right; margin-top:8px; line-height:1.8; }
  @media (max-width: 768px) {
    .container { padding:12px 8px; }
    table { font-size:11px; }
    th, td { padding:6px 4px; }
    .header h1 { font-size:18px; }
  }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>产品研发部党支部 党务积分公示</h1>
    <div class="subtitle">${quarter.year}年 第${quarter.quarter}季度（${startDateStr} ~ ${endDateStr}）</div>
  </div>

  <div class="notice">本页面为党务积分季度汇总公示，数据为当季快照，仅供查阅。</div>

  <div class="section-title">季度汇总</div>
  <table>
    <thead>
      <tr>
        <th style="width:50px">序号</th>
        <th style="width:80px">姓名</th>
        <th>职务</th>
        <th style="width:70px">基础分</th>
        <th style="width:70px">基础加分</th>
        <th style="width:70px">任务加分</th>
        <th style="width:60px">扣分</th>
        <th style="width:70px">季度小计</th>
        <th style="width:70px">累计加分</th>
        <th style="width:70px">归一化5分</th>
      </tr>
    </thead>
    <tbody>
      ${summaryRows}
    </tbody>
  </table>
  <div class="legend">
    全员基础分95分；支委基础加分+5分，党务工作者基础加分+3分（每季度首月）；<br>
    任务加分含分享心得（+0.5分/次）及其他党务任务；归一化5分 = 累计加分 / 最高累计加分 × 5
  </div>

  ${hasDetails ? `
  <div class="section-title">加分明细</div>
  <table>
    <thead>
      <tr>
        <th style="width:80px">姓名</th>
        <th style="width:100px">年月</th>
        <th style="width:120px">类型</th>
        <th style="width:70px">分值</th>
        <th>内容</th>
      </tr>
    </thead>
    <tbody>
      ${detailRows}
    </tbody>
  </table>
  ` : ''}

  <div class="footer">
    产品研发部党支部 · 党员党务积分助手 · 生成于 ${new Date().toLocaleString('zh-CN')}
  </div>
</div>
</body>
</html>`;
}
