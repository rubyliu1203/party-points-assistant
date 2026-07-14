import * as XLSX from 'xlsx';
import prisma from './src/utils/prisma';

async function test() {
  try {
    const scores = await prisma.partyMemberScore.findMany({
      where: { quarterId: 1 },
      include: { partyMember: true },
      take: 2
    });
    
    console.log('Scores count:', scores.length);
    
    const data = scores.map((s, index) => ({
      '序号': index + 1,
      '党员姓名': s.partyMember.name,
      '总分': s.totalScore ?? '-',
    }));
    
    console.log('Data:', data);
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '积分总台账');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    console.log('Buffer size:', buffer.length);
    console.log('Success!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
