import prisma from './prisma';
import { DIM1_QUARTER_SCORES, DIM3_QUARTER_SCORES } from './constants';

/**
 * 判断党员在季度开始时是否在党支部
 */
export function isMemberActiveInQuarter(member: any, quarterStartDate: Date): boolean {
  // joinDate 为空表示历史数据，默认一直存在
  if (member.joinDate && new Date(member.joinDate) > quarterStartDate) {
    return false;
  }
  // transferDate 不为空且 <= 季度开始日期，表示已转出
  if (member.transferDate && new Date(member.transferDate) <= quarterStartDate) {
    return false;
  }
  return true;
}

/**
 * 为单个党员初始化单个季度的所有积分数据
 */
export async function initMemberForQuarter(memberId: number, quarterId: number): Promise<void> {
  const quarter = await prisma.quarter.findUnique({ where: { id: quarterId } });
  if (!quarter) return;

  const member = await prisma.partyMember.findUnique({ where: { id: memberId } });
  if (!member) return;

  // 如果党员不在该季度范围内，跳过
  if (!isMemberActiveInQuarter(member, quarter.startDate)) {
    return;
  }

  const quarterMonths: Record<number, number[]> = {
    1: [1, 2, 3],
    2: [4, 5, 6],
    3: [7, 8, 9],
    4: [10, 11, 12]
  };
  const months = quarterMonths[quarter.quarter] || [];
  const firstMonth = months[0];

  // 1. 初始化党员积分总台账
  await prisma.partyMemberScore.upsert({
    where: {
      partyMemberId_quarterId: {
        partyMemberId: member.id,
        quarterId
      }
    },
    update: {},
    create: {
      partyMemberId: member.id,
      quarterId,
      politicalScore: 20,
      disciplineScore: 20,
      moralityScore: 20,
      bonusScore: 0,
      deductionScore: 0,
      vetoStatus: 'none'
    }
  });

  // 2. 初始化党务加分
  const positions = JSON.parse(member.partyPositions || '[]');
  const isBranchCommittee = positions.length > 0;
  const baseBonus = isBranchCommittee ? 5 : (member.isPartyWorker ? 3 : 0);

  for (const month of months) {
    const monthBaseBonus = (month === firstMonth) ? baseBonus : 0;

    await prisma.partyWorkScore.upsert({
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
        baseScore: 95,
        baseBonus: monthBaseBonus,
        taskBonus: 0,
        deduction: 0,
        monthlyTotal: 95 + monthBaseBonus
      }
    });
  }

  // 3. 初始化履职分明细
  const isManager = member.isManager;
  const dim1Score = isManager ? 4 : (DIM1_QUARTER_SCORES[quarter.quarter]?.other || 3.8);
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
        isHardBattleLeader: isManager,
        isShuangYou: false,
        isTeamLeader: false
      }
    });
  }
}
