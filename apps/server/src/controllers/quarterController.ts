import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { initMemberForQuarter } from '../utils/initScores';

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
  }
};
