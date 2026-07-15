import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import scoreCalculationService from '../services/ScoreCalculationService';
import { isMemberActiveInQuarter } from '../utils/initScores';
import { checkQuarterArchived } from './quarterController';

export const bonusController = {
  // 获取加分记录（归档季度从快照表读取）
  async getBonusRecords(req: Request, res: Response) {
    try {
      const { quarterId, memberId } = req.query;
      const qid = quarterId ? Number(quarterId) : null;
      const mid = memberId ? Number(memberId) : null;

      let isArchived = false;
      if (qid) {
        const quarter = await prisma.quarter.findUnique({ where: { id: qid } });
        isArchived = quarter?.isArchived ?? false;
      }

      let records: any[];
      if (isArchived) {
        const where: any = { quarterId: qid };
        if (mid) where.partyMemberId = mid;
        records = await prisma.archivedBonusRecord.findMany({
          where,
          orderBy: { archivedAt: 'desc' }
        });
        // 补充党员信息
        const members = await prisma.partyMember.findMany();
        records = records.map(r => ({
          ...r,
          partyMember: members.find(m => m.id === r.partyMemberId) || null
        }));
        // 过滤转入/转出
        if (qid) {
          const quarter = await prisma.quarter.findUnique({ where: { id: qid } });
          if (quarter) {
            records = records.filter(r => isMemberActiveInQuarter(r.partyMember, quarter.startDate));
          }
        }
      } else {
        const where: any = {};
        if (qid) where.quarterId = qid;
        if (mid) where.partyMemberId = mid;
        records = await prisma.bonusRecord.findMany({
          where,
          include: { partyMember: true },
          orderBy: { createdAt: 'desc' }
        });
        if (qid) {
          const quarter = await prisma.quarter.findUnique({ where: { id: qid } });
          if (quarter) {
            records = records.filter(r => isMemberActiveInQuarter(r.partyMember, quarter.startDate));
          }
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
      if (await checkQuarterArchived(data.quarterId)) {
        return res.status(403).json({ code: 403, message: '该季度已归档，不允许添加' });
      }

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

      // 先查出记录获取 quarterId
      const existing = await prisma.bonusRecord.findUnique({ where: { id: Number(id) } });
      if (existing && await checkQuarterArchived(existing.quarterId)) {
        return res.status(403).json({ code: 403, message: '该季度已归档，不允许修改' });
      }

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

      if (record && await checkQuarterArchived(record.quarterId)) {
        return res.status(403).json({ code: 403, message: '该季度已归档，不允许删除' });
      }

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
  // 获取扣分记录（归档季度从快照表读取）
  async getDeductionRecords(req: Request, res: Response) {
    try {
      const { quarterId, memberId } = req.query;
      const qid = quarterId ? Number(quarterId) : null;
      const mid = memberId ? Number(memberId) : null;

      let isArchived = false;
      if (qid) {
        const quarter = await prisma.quarter.findUnique({ where: { id: qid } });
        isArchived = quarter?.isArchived ?? false;
      }

      let records: any[];
      if (isArchived) {
        const where: any = { quarterId: qid };
        if (mid) where.partyMemberId = mid;
        records = await prisma.archivedDeductionRecord.findMany({
          where,
          orderBy: { archivedAt: 'desc' }
        });
        const members = await prisma.partyMember.findMany();
        records = records.map(r => ({
          ...r,
          partyMember: members.find(m => m.id === r.partyMemberId) || null
        }));
        if (qid) {
          const quarter = await prisma.quarter.findUnique({ where: { id: qid } });
          if (quarter) {
            records = records.filter(r => isMemberActiveInQuarter(r.partyMember, quarter.startDate));
          }
        }
      } else {
        const where: any = {};
        if (qid) where.quarterId = qid;
        if (mid) where.partyMemberId = mid;
        records = await prisma.deductionRecord.findMany({
          where,
          include: { partyMember: true },
          orderBy: { createdAt: 'desc' }
        });
        if (qid) {
          const quarter = await prisma.quarter.findUnique({ where: { id: qid } });
          if (quarter) {
            records = records.filter(r => isMemberActiveInQuarter(r.partyMember, quarter.startDate));
          }
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
      if (await checkQuarterArchived(data.quarterId)) {
        return res.status(403).json({ code: 403, message: '该季度已归档，不允许添加' });
      }

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

      const existing = await prisma.deductionRecord.findUnique({ where: { id: Number(id) } });
      if (existing && await checkQuarterArchived(existing.quarterId)) {
        return res.status(403).json({ code: 403, message: '该季度已归档，不允许修改' });
      }

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

      if (record && await checkQuarterArchived(record.quarterId)) {
        return res.status(403).json({ code: 403, message: '该季度已归档，不允许删除' });
      }

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
