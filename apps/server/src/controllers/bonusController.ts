import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import scoreCalculationService from '../services/ScoreCalculationService';
import { isMemberActiveInQuarter } from '../utils/initScores';

export const bonusController = {
  // 获取加分记录
  async getBonusRecords(req: Request, res: Response) {
    try {
      const { quarterId, memberId } = req.query;
      const where: any = {};

      if (quarterId) where.quarterId = Number(quarterId);
      if (memberId) where.partyMemberId = Number(memberId);

      let records = await prisma.bonusRecord.findMany({
        where,
        include: { partyMember: true },
        orderBy: { createdAt: 'desc' }
      });

      // 按转入/转出时间过滤
      if (quarterId) {
        const quarter = await prisma.quarter.findUnique({
          where: { id: Number(quarterId) }
        });
        if (quarter) {
          records = records.filter(r => isMemberActiveInQuarter(r.partyMember, quarter.startDate));
        }
      }

      res.json({ code: 200, data: records });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 创建加分记录
  async createBonusRecord(req: Request, res: Response) {
    try {
      const data = req.body;
      
      const record = await prisma.bonusRecord.create({
        data: {
          partyMemberId: data.partyMemberId,
          quarterId: data.quarterId,
          level: data.level,
          score: data.score,
          source: data.source,
          description: data.description,
          awardDate: data.awardDate ? new Date(data.awardDate) : null,
          applyQuarterId: data.applyQuarterId,
          remark: data.remark
        }
      });

      // 重新计算积分
      await scoreCalculationService.calculateAndSaveMemberScore(
        data.partyMemberId,
        data.quarterId
      );

      res.json({ code: 200, data: record });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 更新加分记录
  async updateBonusRecord(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const record = await prisma.bonusRecord.update({
        where: { id: Number(id) },
        data: {
          level: data.level,
          score: data.score,
          source: data.source,
          description: data.description,
          awardDate: data.awardDate ? new Date(data.awardDate) : null,
          remark: data.remark
        }
      });

      // 重新计算积分
      await scoreCalculationService.calculateAndSaveMemberScore(
        record.partyMemberId,
        record.quarterId
      );

      res.json({ code: 200, data: record });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 删除加分记录
  async deleteBonusRecord(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      const record = await prisma.bonusRecord.findUnique({
        where: { id: Number(id) }
      });

      if (!record) {
        return res.status(404).json({ code: 404, message: '记录不存在' });
      }

      await prisma.bonusRecord.delete({
        where: { id: Number(id) }
      });

      // 重新计算积分
      await scoreCalculationService.calculateAndSaveMemberScore(
        record.partyMemberId,
        record.quarterId
      );

      res.json({ code: 200, message: '删除成功' });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  }
};

export const deductionController = {
  // 获取扣分记录
  async getDeductionRecords(req: Request, res: Response) {
    try {
      const { quarterId, memberId } = req.query;
      const where: any = {};

      if (quarterId) where.quarterId = Number(quarterId);
      if (memberId) where.partyMemberId = Number(memberId);

      let records = await prisma.deductionRecord.findMany({
        where,
        include: { partyMember: true },
        orderBy: { createdAt: 'desc' }
      });

      // 按转入/转出时间过滤
      if (quarterId) {
        const quarter = await prisma.quarter.findUnique({
          where: { id: Number(quarterId) }
        });
        if (quarter) {
          records = records.filter(r => isMemberActiveInQuarter(r.partyMember, quarter.startDate));
        }
      }

      res.json({ code: 200, data: records });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 创建扣分记录
  async createDeductionRecord(req: Request, res: Response) {
    try {
      const data = req.body;
      
      const record = await prisma.deductionRecord.create({
        data: {
          partyMemberId: data.partyMemberId,
          quarterId: data.quarterId,
          type: data.type,
          score: data.score,
          occurrenceDate: data.occurrenceDate ? new Date(data.occurrenceDate) : null,
          description: data.description,
          remark: data.remark
        }
      });

      // 重新计算积分
      await scoreCalculationService.calculateAndSaveMemberScore(
        data.partyMemberId,
        data.quarterId
      );

      res.json({ code: 200, data: record });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 更新扣分记录
  async updateDeductionRecord(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const record = await prisma.deductionRecord.update({
        where: { id: Number(id) },
        data: {
          type: data.type,
          score: data.score,
          occurrenceDate: data.occurrenceDate ? new Date(data.occurrenceDate) : null,
          description: data.description,
          remark: data.remark
        }
      });

      // 重新计算积分
      await scoreCalculationService.calculateAndSaveMemberScore(
        record.partyMemberId,
        record.quarterId
      );

      res.json({ code: 200, data: record });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 删除扣分记录
  async deleteDeductionRecord(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      const record = await prisma.deductionRecord.findUnique({
        where: { id: Number(id) }
      });

      if (!record) {
        return res.status(404).json({ code: 404, message: '记录不存在' });
      }

      await prisma.deductionRecord.delete({
        where: { id: Number(id) }
      });

      // 重新计算积分
      await scoreCalculationService.calculateAndSaveMemberScore(
        record.partyMemberId,
        record.quarterId
      );

      res.json({ code: 200, message: '删除成功' });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  }
};
