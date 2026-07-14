import { api } from './config';

export interface BonusRecord {
  id: number;
  partyMemberId: number;
  quarterId: number;
  level: number;
  score: number;
  source: string | null;
  description: string | null;
  awardDate: string | null;
  remark: string | null;
  partyMember: {
    id: number;
    name: string;
  };
}

export interface DeductionRecord {
  id: number;
  partyMemberId: number;
  quarterId: number;
  type: number;
  score: number;
  occurrenceDate: string | null;
  description: string | null;
  remark: string | null;
  partyMember: {
    id: number;
    name: string;
  };
}

export const bonusApi = {
  getBonusRecords: (params?: { quarterId?: number; memberId?: number }) =>
    api.get('/bonus-records', { params }),

  createBonusRecord: (data: Partial<BonusRecord>) =>
    api.post('/bonus-records', data),

  updateBonusRecord: (id: number, data: Partial<BonusRecord>) =>
    api.put(`/bonus-records/${id}`, data),

  deleteBonusRecord: (id: number) =>
    api.delete(`/bonus-records/${id}`)
};

export const deductionApi = {
  getDeductionRecords: (params?: { quarterId?: number; memberId?: number }) =>
    api.get('/deduction-records', { params }),

  createDeductionRecord: (data: Partial<DeductionRecord>) =>
    api.post('/deduction-records', data),

  updateDeductionRecord: (id: number, data: Partial<DeductionRecord>) =>
    api.put(`/deduction-records/${id}`, data),

  deleteDeductionRecord: (id: number) =>
    api.delete(`/deduction-records/${id}`)
};
