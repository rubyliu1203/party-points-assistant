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
  }
};
