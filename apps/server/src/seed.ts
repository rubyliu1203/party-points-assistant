import prisma from './utils/prisma';

async function seed() {
  console.log('🌱 开始初始化数据...');

  // 1. 创建系统设置
  await prisma.systemSetting.upsert({
    where: { key: 'department_name' },
    update: {},
    create: {
      key: 'department_name',
      value: '产品研发部党支部',
      description: '党支部名称'
    }
  });

  // 2. 导入党员名单（从Excel分析得到）
  const members = [
    { name: '高伟', displayOrder: 1 },
    { name: '朱艳春', partyPositions: '["书记"]', isPartyWorker: false, displayOrder: 2 },
    { name: '吴诗韵', partyPositions: '["组织委员","纪检委员"]', isPartyWorker: false, displayOrder: 3 },
    { name: '段占南', partyPositions: '["宣传委员"]', isPartyWorker: false, displayOrder: 4 },
    { name: '韦佳威', isPartyWorker: true, displayOrder: 5 },
    { name: '陈光俊', displayOrder: 6 },
    { name: '覃琳', isPartyWorker: true, displayOrder: 7 },
    { name: '吕南英', isPartyWorker: true, displayOrder: 8 },
    { name: '黄志安', isPartyWorker: true, displayOrder: 9 },
    { name: '叶仙容', isPartyWorker: true, displayOrder: 10 },
    { name: '陈强', displayOrder: 11 },
    { name: '高唯唯', isPartyWorker: true, displayOrder: 12 },
    { name: '江国林', displayOrder: 13 },
    { name: '沈祥', displayOrder: 14 },
    { name: '刘树敏', displayOrder: 15 },
    { name: '周柱良', displayOrder: 16 },
    { name: '邝瑞杰', isPartyWorker: true, displayOrder: 17 },
    { name: '梁练', displayOrder: 18 },
    { name: '阮志明', isPartyWorker: true, displayOrder: 19 },
    { name: '武文栋', isPartyWorker: true, displayOrder: 20 },
    { name: '刘国臻', displayOrder: 21 },
    { name: '刘婷', displayOrder: 22 },
    { name: '张文柠', isPartyWorker: true, displayOrder: 23 },
    { name: '矫承洋', displayOrder: 24 },
    { name: '卢泉', displayOrder: 25 },
    { name: '崔晓博', displayOrder: 26 }
  ];

  for (const memberData of members) {
    await prisma.partyMember.upsert({
      where: { id: members.indexOf(memberData) + 1 },
      update: {},
      create: {
        name: memberData.name,
        partyPositions: memberData.partyPositions || '[]',
        isPartyWorker: memberData.isPartyWorker || false,
        displayOrder: memberData.displayOrder,
        status: 'active'
      }
    });
  }

  console.log(`✅ 已导入 ${members.length} 名党员`);

  // 3. 创建2026年Q2季度
  const quarter = await prisma.quarter.upsert({
    where: { year_quarter: { year: 2026, quarter: 2 } },
    update: {},
    create: {
      year: 2026,
      quarter: 2,
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-06-30'),
      status: 'active'
    }
  });

  console.log(`✅ 已创建季度: ${quarter.year}年Q${quarter.quarter}`);

  // 4. 设置当前季度
  await prisma.systemSetting.upsert({
    where: { key: 'current_quarter_id' },
    update: { value: String(quarter.id) },
    create: {
      key: 'current_quarter_id',
      value: String(quarter.id),
      description: '当前激活的季度ID'
    }
  });

  // 5. 初始化党员积分记录
  const allMembers = await prisma.partyMember.findMany();
  for (const member of allMembers) {
    await prisma.partyMemberScore.upsert({
      where: {
        partyMemberId_quarterId: {
          partyMemberId: member.id,
          quarterId: quarter.id
        }
      },
      update: {},
      create: {
        partyMemberId: member.id,
        quarterId: quarter.id,
        politicalScore: 20,
        disciplineScore: 20,
        moralityScore: 20,
        bonusScore: 0,
        deductionScore: 0,
        vetoStatus: 'none'
      }
    });
  }

  console.log(`✅ 已初始化 ${allMembers.length} 名党员的积分记录`);

  // 6. 初始化履职分明细（4月、5月、6月）
  const months = [4, 5, 6];
  for (const member of allMembers) {
    for (const month of months) {
      await prisma.roleScoreDetail.upsert({
        where: {
          partyMemberId_quarterId_year_month: {
            partyMemberId: member.id,
            quarterId: quarter.id,
            year: 2026,
            month
          }
        },
        update: {},
        create: {
          partyMemberId: member.id,
          quarterId: quarter.id,
          year: 2026,
          month,
          dim1HardBattle: 3.8,
          dim2TechShare: 4,
          dim3ShuangYou: 3.8,
          dim4Culture: 3.8,
          dim5ChinaStory: 3
        }
      });
    }
  }

  console.log(`✅ 已初始化履职分明细`);
  console.log('🎉 数据初始化完成！');
}

seed()
  .catch((e) => {
    console.error('❌ 初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
