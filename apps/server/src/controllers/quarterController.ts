import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { initMemberForQuarter } from '../utils/initScores';
import scoreCalculationService from '../services/ScoreCalculationService';

// 检查季度是否已归档
export async function checkQuarterArchived(quarterId: number): Promise<boolean> {
  const quarter = await prisma.quarter.findUnique({ where: { id: quarterId } });
  return quarter?.isArchived ?? false;
}

export const quarterController = {
  // 获取季度列表
  async getQuarters(req: Request, res: Response) {
    try {
      const quarters = await prisma.quarter.findMany({
        orderBy: [{ year: 'desc' }, { quarter: 'desc' }]
      });
      res.json({ code: 200, data: quarters });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 创建季度
  async createQuarter(req: Request, res: Response) {
    try {
      const { year, quarter, startDate, endDate } = req.body;

      // 检查是否已存在
      const existing = await prisma.quarter.findUnique({
        where: { year_quarter: { year, quarter } }
      });

      if (existing) {
        return res.status(409).json({ code: 409, message: '该季度已存在' });
      }

      const newQuarter = await prisma.quarter.create({
        data: {
          year,
          quarter,
          startDate: new Date(startDate),
          endDate: new Date(endDate)
        }
      });

      // 初始化所有党员的积分记录
      const members = await prisma.partyMember.findMany({
        where: { status: 'active' }
      });

      for (const member of members) {
        await initMemberForQuarter(member.id, newQuarter.id);
      }

      res.json({ code: 200, data: newQuarter });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 获取当前季度设置
  async getCurrentQuarter(req: Request, res: Response) {
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: { key: 'current_quarter_id' }
      });

      if (!setting?.value) {
        return res.json({ code: 200, data: null });
      }

      const quarter = await prisma.quarter.findUnique({
        where: { id: Number(setting.value) }
      });

      res.json({ code: 200, data: quarter });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 设置当前季度
  async setCurrentQuarter(req: Request, res: Response) {
    try {
      const { quarterId } = req.body;
      
      await prisma.systemSetting.upsert({
        where: { key: 'current_quarter_id' },
        update: { value: String(quarterId) },
        create: {
          key: 'current_quarter_id',
          value: String(quarterId),
          description: '当前激活的季度ID'
        }
      });

      res.json({ code: 200, message: '设置成功' });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 归档季度：将数据复制到归档快照表，实现物理隔离
  async archiveQuarter(req: Request, res: Response) {
    try {
      const { quarterId } = req.params;
      const id = Number(quarterId);

      const quarter = await prisma.quarter.findUnique({ where: { id } });
      if (!quarter) {
        return res.status(404).json({ code: 404, message: '季度不存在' });
      }

      if (quarter.isArchived) {
        return res.status(409).json({ code: 409, message: '该季度已归档' });
      }

      // 1. 重新计算所有党员积分，确保数据最新
      await scoreCalculationService.recalculateQuarterScores(id);

      // 2. 清空旧归档快照（支持重复归档）
      await prisma.archivedPartyMemberScore.deleteMany({ where: { quarterId: id } });
      await prisma.archivedRoleScoreDetail.deleteMany({ where: { quarterId: id } });
      await prisma.archivedBonusRecord.deleteMany({ where: { quarterId: id } });
      await prisma.archivedDeductionRecord.deleteMany({ where: { quarterId: id } });
      await prisma.archivedPartyWorkScore.deleteMany({ where: { quarterId: id } });
      await prisma.archivedPartyWorkBonusDetail.deleteMany({ where: { quarterId: id } });

      // 3. 复制党员积分快照
      const memberScores = await prisma.partyMemberScore.findMany({ where: { quarterId: id } });
      for (const s of memberScores) {
        await prisma.archivedPartyMemberScore.create({
          data: {
            partyMemberId: s.partyMemberId,
            quarterId: s.quarterId,
            politicalScore: s.politicalScore,
            disciplineScore: s.disciplineScore,
            moralityScore: s.moralityScore,
            performanceLevel: s.performanceLevel,
            performanceScore: s.performanceScore,
            roleScore: s.roleScore,
            bonusScore: s.bonusScore,
            deductionScore: s.deductionScore,
            vetoStatus: s.vetoStatus,
            totalScore: s.totalScore,
            remark: s.remark,
          }
        });
      }

      // 4. 复制履职分明细快照
      const roleDetails = await prisma.roleScoreDetail.findMany({ where: { quarterId: id } });
      for (const d of roleDetails) {
        await prisma.archivedRoleScoreDetail.create({
          data: {
            partyMemberId: d.partyMemberId,
            quarterId: d.quarterId,
            year: d.year,
            month: d.month,
            dim1HardBattle: d.dim1HardBattle,
            dim2TechShare: d.dim2TechShare,
            dim3ShuangYou: d.dim3ShuangYou,
            dim4Culture: d.dim4Culture,
            dim5ChinaStory: d.dim5ChinaStory,
            isHardBattleLeader: d.isHardBattleLeader,
            isShuangYou: d.isShuangYou,
            isTeamLeader: d.isTeamLeader,
            cultureBaseScore: d.cultureBaseScore,
            monthlyTotal: d.monthlyTotal,
            remark: d.remark,
          }
        });
      }

      // 5. 复制加分记录快照
      const bonusRecords = await prisma.bonusRecord.findMany({ where: { quarterId: id } });
      for (const r of bonusRecords) {
        await prisma.archivedBonusRecord.create({
          data: {
            partyMemberId: r.partyMemberId,
            quarterId: r.quarterId,
            level: r.level,
            score: r.score,
            source: r.source,
            description: r.description,
            awardDate: r.awardDate,
            applyQuarterId: r.applyQuarterId,
            remark: r.remark,
          }
        });
      }

      // 6. 复制扣分记录快照
      const deductionRecords = await prisma.deductionRecord.findMany({ where: { quarterId: id } });
      for (const r of deductionRecords) {
        await prisma.archivedDeductionRecord.create({
          data: {
            partyMemberId: r.partyMemberId,
            quarterId: r.quarterId,
            type: r.type,
            score: r.score,
            occurrenceDate: r.occurrenceDate,
            description: r.description,
            remark: r.remark,
          }
        });
      }

      // 7. 复制党务积分月度快照
      const workScores = await prisma.partyWorkScore.findMany({ where: { quarterId: id } });
      for (const s of workScores) {
        await prisma.archivedPartyWorkScore.create({
          data: {
            partyMemberId: s.partyMemberId,
            quarterId: s.quarterId,
            year: s.year,
            month: s.month,
            baseScore: s.baseScore,
            baseBonus: s.baseBonus,
            taskBonus: s.taskBonus,
            deduction: s.deduction,
            monthlyTotal: s.monthlyTotal,
            remark: s.remark,
          }
        });
      }

      // 8. 复制党务加分明细快照
      const workBonusDetails = await prisma.partyWorkBonusDetail.findMany({ where: { quarterId: id } });
      for (const d of workBonusDetails) {
        await prisma.archivedPartyWorkBonusDetail.create({
          data: {
            partyMemberId: d.partyMemberId,
            quarterId: d.quarterId,
            year: d.year,
            month: d.month,
            type: d.type,
            content: d.content,
            score: d.score,
            remark: d.remark,
          }
        });
      }

      // 9. 标记季度为已归档
      await prisma.quarter.update({
        where: { id },
        data: { isArchived: true, archivedAt: new Date() }
      });

      res.json({ code: 200, message: '归档成功，该季度数据已冻结' });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  }
};
