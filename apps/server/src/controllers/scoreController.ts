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
  }
};
