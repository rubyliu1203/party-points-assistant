import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import scoreCalculationService from '../services/ScoreCalculationService';
import { isMemberActiveInQuarter } from '../utils/initScores';

export const scoreController = {
  // 获取积分总台账
  async getScores(req: Request, res: Response) {
    try {
      const { quarterId } = req.query;
      
      if (!quarterId) {
        return res.status(400).json({ code: 400, message: '缺少quarterId参数' });
      }

      const quarter = await prisma.quarter.findUnique({
        where: { id: Number(quarterId) }
      });

      let scores = await prisma.partyMemberScore.findMany({
        where: { quarterId: Number(quarterId) },
        include: { partyMember: true },
        orderBy: {
          partyMember: { displayOrder: 'asc' }
        }
      });

      // 按转入/转出时间过滤
      if (quarter) {
        scores = scores.filter(s => isMemberActiveInQuarter(s.partyMember, quarter.startDate));
      }

      res.json({ code: 200, data: scores });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 获取单个党员积分详情
  async getMemberScore(req: Request, res: Response) {
    try {
      const { memberId, quarterId } = req.params;

      const score = await prisma.partyMemberScore.findUnique({
        where: {
          partyMemberId_quarterId: {
            partyMemberId: Number(memberId),
            quarterId: Number(quarterId)
          }
        },
        include: { partyMember: true }
      });

      if (!score) {
        return res.status(404).json({ code: 404, message: '积分记录不存在' });
      }

      const roleDetails = await prisma.roleScoreDetail.findMany({
        where: {
          partyMemberId: Number(memberId),
          quarterId: Number(quarterId)
        },
        orderBy: [{ year: 'asc' }, { month: 'asc' }]
      });

      const bonusRecords = await prisma.bonusRecord.findMany({
        where: {
          partyMemberId: Number(memberId),
          quarterId: Number(quarterId)
        }
      });

      const deductionRecords = await prisma.deductionRecord.findMany({
        where: {
          partyMemberId: Number(memberId),
          quarterId: Number(quarterId)
        }
      });

      res.json({
        code: 200,
        data: {
          score,
          roleDetails,
          bonusRecords,
          deductionRecords
        }
      });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 更新绩效等级
  async updatePerformance(req: Request, res: Response) {
    try {
      const { memberId, quarterId } = req.params;
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
      const result = await scoreCalculationService.recalculateQuarterScores(Number(quarterId));
      res.json({ code: 200, message: '计算完成', data: result });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 获取履职分明细
  async getRoleScores(req: Request, res: Response) {
    try {
      const { memberId, quarterId } = req.params;
      
      const details = await prisma.roleScoreDetail.findMany({
        where: {
          partyMemberId: Number(memberId),
          quarterId: Number(quarterId)
        },
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
