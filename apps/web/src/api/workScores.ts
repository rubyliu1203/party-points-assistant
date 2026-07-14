import { api } from './config';

export interface PartyWorkScore {
  id: number;
  partyMemberId: number;
  quarterId: number;
  year: number;
  month: number;
  baseScore: number;
  baseBonus: number;
  taskBonus: number;
  deduction: number;
  monthlyTotal: number | null;
  partyMember: {
    id: number;
    name: string;
  };
}

export interface PartyWorkBonusDetail {
  id: number;
  partyMemberId: number;
  quarterId: number;
  year: number;
  month: number;
  type: string;
  content: string | null;
  score: number;
  partyMember: {
    id: number;
    name: string;
  };
}

export const workScoreApi = {
  getWorkScores: (params: { quarterId: number; year?: number; month?: number }) =>
    api.get('/work-scores', { params }),

  getWorkScoreSummary: (quarterId: number) =>
    api.get('/work-scores/summary', { params: { quarterId } }),

  updateWorkScore: (id: number, data: Partial<PartyWorkScore>) =>
    api.put(`/work-scores/${id}`, data),

  recalculateBaseBonus: (quarterId: number) =>
    api.post('/work-scores/recalculate', null, { params: { quarterId } }),

  getWorkScoreDetails: (params: { quarterId?: number; year?: number; month?: number }) =>
    api.get('/work-score-details', { params }),

  createWorkScoreDetail: (data: Partial<PartyWorkBonusDetail>) =>
    api.post('/work-score-details', data),

  deleteWorkScoreDetail: (id: number) =>
    api.delete(`/work-score-details/${id}`)
};
