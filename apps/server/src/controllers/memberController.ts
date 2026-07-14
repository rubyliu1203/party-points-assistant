import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { initMemberForQuarter } from '../utils/initScores';

export const memberController = {
  // 获取党员列表
  async getMembers(req: Request, res: Response) {
    try {
      const { status, search } = req.query;
      const where: any = {};
      
      if (status) where.status = status;
      if (search) {
        where.name = { contains: search as string };
      }

      const members = await prisma.partyMember.findMany({
        where,
        orderBy: { displayOrder: 'asc' }
      });

      res.json({ code: 200, data: members });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 获取单个党员
  async getMember(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const member = await prisma.partyMember.findUnique({
        where: { id: Number(id) }
      });
      
      if (!member) {
        return res.status(404).json({ code: 404, message: '党员不存在' });
      }

      res.json({ code: 200, data: member });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 创建党员
  async createMember(req: Request, res: Response) {
    try {
      const { name, partyPositions, isPartyWorker, isManager, status, joinDate, transferDate, remark } = req.body;

      // 自动分配序号：取当前最大 displayOrder + 1
      const lastMember = await prisma.partyMember.findFirst({
        orderBy: { displayOrder: 'desc' }
      });
      const nextOrder = (lastMember?.displayOrder || 0) + 1;

      const member = await prisma.partyMember.create({
        data: {
          name,
          partyPositions: JSON.stringify(partyPositions || []),
          isPartyWorker: isPartyWorker || false,
          isManager: isManager || false,
          status: status || 'active',
          joinDate: joinDate ? new Date(joinDate) : null,
          transferDate: transferDate ? new Date(transferDate) : null,
          displayOrder: nextOrder,
          remark
        }
      });

      // 为所有已有季度初始化该党员的积分数据
      const quarters = await prisma.quarter.findMany();
      for (const quarter of quarters) {
        await initMemberForQuarter(member.id, quarter.id);
      }

      res.json({ code: 200, data: member });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 更新党员
  async updateMember(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, partyPositions, isPartyWorker, isManager, status, joinDate, transferDate, remark } = req.body;

      const member = await prisma.partyMember.update({
        where: { id: Number(id) },
        data: {
          name,
          partyPositions: partyPositions ? JSON.stringify(partyPositions) : undefined,
          isPartyWorker,
          isManager,
          status,
          joinDate: joinDate ? new Date(joinDate) : undefined,
          transferDate: transferDate ? new Date(transferDate) : undefined,
          remark
        }
      });

      res.json({ code: 200, data: member });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  },

  // 删除党员
  async deleteMember(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await prisma.partyMember.delete({
        where: { id: Number(id) }
      });

      res.json({ code: 200, message: '删除成功' });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  }
};
