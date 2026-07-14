import { api } from './config';

export interface PartyMember {
  id: number;
  name: string;
  partyPositions: string;
  isPartyWorker: boolean;
  isManager: boolean;
  status: string;
  joinDate: string | null;
  transferDate: string | null;
  displayOrder: number;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemberData {
  name: string;
  partyPositions?: string[];
  isPartyWorker?: boolean;
  isManager?: boolean;
  status?: string;
  joinDate?: string;
  transferDate?: string;
  remark?: string;
}

export const memberApi = {
  getMembers: (params?: { status?: string; search?: string }) =>
    api.get('/members', { params }),

  getMember: (id: number) =>
    api.get(`/members/${id}`),

  createMember: (data: CreateMemberData) =>
    api.post('/members', data),

  updateMember: (id: number, data: Partial<CreateMemberData>) =>
    api.put(`/members/${id}`, data),

  deleteMember: (id: number) =>
    api.delete(`/members/${id}`)
};
