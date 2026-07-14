import { api } from './config';

export interface Quarter {
  id: number;
  year: number;
  quarter: number;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export const quarterApi = {
  getQuarters: () =>
    api.get('/quarters'),

  createQuarter: (data: { year: number; quarter: number; startDate: string; endDate: string }) =>
    api.post('/quarters', data),

  getCurrentQuarter: () =>
    api.get('/quarters/current'),

  setCurrentQuarter: (quarterId: number) =>
    api.put('/quarters/current', { quarterId })
};
