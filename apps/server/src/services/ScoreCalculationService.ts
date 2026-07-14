import prisma from '../utils/prisma';
import { PERFORMANCE_LEVELS, DIM1_QUARTER_SCORES, DIM3_QUARTER_SCORES } from '../utils/constants';
import { isMemberActiveInQuarter } from '../utils/initScores';

class ScoreCalculationService {
  /**
   * 重新计算某季度所有党员积分
   */
  async recalculateQuarterScores(quarterId: number): Promise<{ updated: number }> {
    const quarter = await prisma.quarter.findUnique({ where: { id: quarterId } });
    if (!quarter) return { updated: 0 };

    const scores = await prisma.partyMemberScore.findMany({
      where: { quarterId },
      include: { partyMember: true }
    });

    let updated = 0;
    for (const score of scores) {
      // 跳过不在该季度的党员
      if (!isMemberActiveInQuarter(score.partyMember, quarter.startDate)) {
        continue;
      }
      await this.calculateAndSaveMemberScore(score.partyMemberId, quarterId);
      updated++;
    }

    return { updated };
  }

  /**
   * 计算并保存单个党员积分
   */
  async calculateAndSaveMemberScore(partyMemberId: number, quarterId: number) {
    const quarter = await prisma.quarter.findUnique({ where: { id: quarterId } });
    if (!quarter) throw new Error('季度不存在');

    const member = await prisma.partyMember.findUnique({ where: { id: partyMemberId } });
    if (!member || !isMemberActiveInQuarter(member, quarter.startDate)) {
      throw new Error('党员不在该季度范围内');
    }

    // 1. 基础分（默认各20分）
    let politicalScore = 20;
    let disciplineScore = 20;
    let moralityScore = 20;

    // 2. 履职分 - 季度绩效得分
    const scoreRecord = await prisma.partyMemberScore.findUnique({
      where: {
        partyMemberId_quarterId: {
          partyMemberId,
          quarterId
        }
      }
    });

    const performanceScore = scoreRecord?.performanceLevel
      ? (PERFORMANCE_LEVELS[scoreRecord.performanceLevel] || 0)
      : 0;

    // 3. 发挥作用合格分（5个维度季度平均）
    const roleScore = await this.calculateRoleScore(partyMemberId, quarterId);

    // 4. 加分项（取最高一级）
    const bonusScore = await this.calculateBonusScore(partyMemberId, quarterId);

    // 5. 扣分项（累加）
    const deductionScore = await this.calculateDeductionScore(partyMemberId, quarterId);

    // 6. 计算总分
    let totalScore =
      politicalScore +
      disciplineScore +
      moralityScore +
      performanceScore +
      roleScore +
      bonusScore -
      deductionScore;

    // 7. 应用一票否决
    const vetoStatus = scoreRecord?.vetoStatus || 'none';
    if (vetoStatus === 'light') {
      totalScore = Math.min(totalScore, 60);
    } else if (vetoStatus === 'severe') {
      totalScore = 0;
    }

    // 8. 保存计算结果
    await prisma.partyMemberScore.update({
      where: {
        partyMemberId_quarterId: {
          partyMemberId,
          quarterId
        }
      },
      data: {
        politicalScore,
        disciplineScore,
        moralityScore,
        performanceScore,
        roleScore,
        bonusScore,
        deductionScore,
        totalScore
      }
    });

    return {
      politicalScore,
      disciplineScore,
      moralityScore,
      performanceScore,
      roleScore,
      bonusScore,
      deductionScore,
      totalScore,
      vetoStatus
    };
  }

  /**
   * 计算发挥作用合格分（5个维度季度平均）
   */
  private async calculateRoleScore(partyMemberId: number, quarterId: number): Promise<number> {
    const details = await prisma.roleScoreDetail.findMany({
      where: { partyMemberId, quarterId }
    });

    if (details.length === 0) return 0;

    const avg = (vals: number[]) => vals.reduce((a, b) => a + b, 0) / vals.length;

    const avgDim1 = avg(details.map(d => d.dim1HardBattle));
    const avgDim2 = avg(details.map(d => d.dim2TechShare));
    const avgDim3 = avg(details.map(d => d.dim3ShuangYou));
    const avgDim4 = avg(details.map(d => d.dim4Culture));
    const avgDim5 = avg(details.map(d => d.dim5ChinaStory));

    return Number((avgDim1 + avgDim2 + avgDim3 + avgDim4 + avgDim5).toFixed(2));
  }

  /**
   * 计算加分项（取最高一级）
   */
  private async calculateBonusScore(partyMemberId: number, quarterId: number): Promise<number> {
    const records = await prisma.bonusRecord.findMany({
      where: { partyMemberId, quarterId }
    });

    if (records.length === 0) return 0;

    const highestLevel = Math.min(...records.map(r => r.level));
    const highestRecord = records.find(r => r.level === highestLevel);

    return highestRecord ? highestRecord.score : 0;
  }

  /**
   * 计算扣分项（累加）
   */
  private async calculateDeductionScore(partyMemberId: number, quarterId: number): Promise<number> {
    const records = await prisma.deductionRecord.findMany({
      where: { partyMemberId, quarterId }
    });

    return records.reduce((sum, r) => sum + r.score, 0);
  }

  /**
   * 自动填充季度履职分明细（按月）
   */
  async initRoleScoreDetails(quarterId: number): Promise<void> {
    const quarter = await prisma.quarter.findUnique({ where: { id: quarterId } });
    if (!quarter) return;

    const allMembers = await prisma.partyMember.findMany({
      where: { status: 'active' }
    });

    // 过滤：只初始化在季度开始时在党支部的党员
    const members = allMembers.filter(m => isMemberActiveInQuarter(m, quarter.startDate));

    const months = this.getQuarterMonths(quarter.quarter);

    for (const member of members) {
      // 判断是否管理层（使用数据库字段，动态）
      const isManager = member.isManager;
      
      // 维度1：攻坚克难
      // 管理层默认4分，其他人按季度规则
      const dim1Score = isManager ? 4 : (DIM1_QUARTER_SCORES[quarter.quarter]?.other || 3.8);
      
      // 维度3：双优评选
      // 管理层默认4分，其他人按季度规则
      const dim3Score = isManager ? 4 : (DIM3_QUARTER_SCORES[quarter.quarter]?.other || 3.8);
      
      for (const month of months) {
        await prisma.roleScoreDetail.upsert({
          where: {
            partyMemberId_quarterId_year_month: {
              partyMemberId: member.id,
              quarterId,
              year: quarter.year,
              month
            }
          },
          update: {},
          create: {
            partyMemberId: member.id,
            quarterId,
            year: quarter.year,
            month,
            dim1HardBattle: dim1Score,
            dim2TechShare: 4,
            dim3ShuangYou: dim3Score,
            dim4Culture: 0,
            dim5ChinaStory: 3,
            isHardBattleLeader: isManager, // 管理层标记为攻坚队责任党员
            isShuangYou: false,
            isTeamLeader: false
          }
        });
      }
    }
  }

  private getQuarterMonths(quarter: number): number[] {
    const map: Record<number, number[]> = {
      1: [1, 2, 3],
      2: [4, 5, 6],
      3: [7, 8, 9],
      4: [10, 11, 12]
    };
    return map[quarter] || [];
  }
}

export default new ScoreCalculationService();
