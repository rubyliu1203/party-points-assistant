import { api } from './config';

export interface PartyMemberScore {
  id: number;
  partyMemberId: number;
  quarterId: number;
  politicalScore: number;
  disciplineScore: number;
  moralityScore: number;
  performanceLevel: string | null;
  performanceScore: number | null;
  roleScore: number | null;
  bonusScore: number;
  deductionScore: number;
  vetoStatus: string;
  totalScore: number | null;
  remark: string | null;
  partyMember: {
    id: number;
    name: string;
    partyPositions: string;
    isPartyWorker: boolean;
  };
}

export interface RoleScoreDetail {
  id: number;
  partyMemberId: number;
  quarterId: number;
  year: number;
  month: number;
  dim1HardBattle: number;
  dim2TechShare: number;
  dim3ShuangYou: number;
  dim4Culture: number;
  dim5ChinaStory: number;
  isHardBattleLeader: boolean;
  isShuangYou: boolean;
  isTeamLeader: boolean;
  cultureBaseScore: number | null;
  monthlyTotal: number | null;
}

export const scoreApi = {
  getScores: (quarterId: number) =>
    api.get('/scores', { params: { quarterId } }),

  getMemberScore: (memberId: number, quarterId: number) =>
    api.get(`/scores/${memberId}/${quarterId}`),

  updatePerformance: (memberId: number, quarterId: number, performanceLevel: string) =>
    api.put(`/scores/${memberId}/${quarterId}/performance`, { performanceLevel }),

  updateBasicScore: (memberId: number, quarterId: number, data: {
    politicalScore?: number;
    disciplineScore?: number;
    moralityScore?: number;
  }) =>
    api.put(`/scores/${memberId}/${quarterId}/basic`, data),

  updateVeto: (memberId: number, quarterId: number, vetoStatus: string) =>
    api.put(`/scores/${memberId}/${quarterId}/veto`, { vetoStatus }),

  recalculateScores: (quarterId: number) =>
    api.post(`/scores/${quarterId}/recalculate`),

  getRoleScores: (memberId: number, quarterId: number) =>
    api.get(`/role-scores/${memberId}/${quarterId}`),

  updateRoleScore: (detailId: number, data: Partial<RoleScoreDetail>) =>
    api.put(`/role-scores/${detailId}`, data)
};
