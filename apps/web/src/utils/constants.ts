export const PARTY_POSITIONS = [
  '书记',
  '副书记',
  '组织委员',
  '纪检委员',
  '宣传委员',
  '统战委员',
  '青年委员'
];

export const PERFORMANCE_LEVELS: Record<string, number> = {
  'A': 20,
  'B+': 16,
  'B': 14,
  'C': 12,
  'D': 10
};

export const BONUS_LEVELS = [
  { value: 1, label: '国家级表彰', score: 10 },
  { value: 2, label: '省部级表彰', score: 8 },
  { value: 3, label: '省委/政府部门/集团公司', score: 6 },
  { value: 4, label: '市级政府/省公司', score: 4 },
  { value: 5, label: '省公司部门/市公司', score: 2 },
  { value: 6, label: '县区级政府', score: 1 },
  { value: 7, label: '重大贡献', score: 0 }
];

export const DEDUCTION_TYPES = [
  { value: 1, label: '不主动按时足额缴纳党费', score: 0.5 },
  { value: 2, label: '不按时参加组织生活', score: 1 },
  { value: 3, label: '知识测试不合格', score: 1 },
  { value: 4, label: '学习时长不足', score: 1 },
  { value: 5, label: '不按组织要求参加培训', score: 1 },
  { value: 6, label: '党建考核抽查错误', score: 2 },
  { value: 7, label: '组织关系/档案问题', score: 2 },
  { value: 8, label: '不与党组织联系', score: 2 },
  { value: 9, label: '不服从工作分配', score: 3 },
  { value: 10, label: '联系群众不紧密', score: 2 },
  { value: 11, label: '被通报批评', score: 3 },
  { value: 12, label: '违反网络行为规定', score: 10 },
  { value: 13, label: '被组织处理', score: 15 }
];

export const QUARTER_MONTHS: Record<number, number[]> = {
  1: [1, 2, 3],
  2: [4, 5, 6],
  3: [7, 8, 9],
  4: [10, 11, 12]
};
