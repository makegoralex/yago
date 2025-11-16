import { create } from 'zustand';

import api from '../lib/api';
import { DEFAULT_POS_CONTEXT } from '../constants/posContext';

export type ShiftSummary = {
  _id: string;
  registerId: string;
  openedAt: string;
  closedAt?: string | null;
  status: 'open' | 'closed';
};

const mapShift = (shift: any): ShiftSummary | null => {
  if (!shift || typeof shift !== 'object') {
    return null;
  }

  const id = shift._id ?? shift.id;
  if (!id) {
    return null;
  }

  const openedAtRaw = shift.openedAt ? new Date(shift.openedAt) : new Date();
  const closedAtValue = shift.closedAt ? new Date(shift.closedAt) : null;
  const status: ShiftSummary['status'] = shift.status === 'closed' ? 'closed' : 'open';

  return {
    _id: String(id),
    registerId: typeof shift.registerId === 'string' ? shift.registerId : DEFAULT_POS_CONTEXT.registerId,
    openedAt: openedAtRaw.toISOString(),
    closedAt: closedAtValue ? closedAtValue.toISOString() : null,
    status,
  };
};

interface ShiftState {
  currentShift: ShiftSummary | null;
  loading: boolean;
  opening: boolean;
  closing: boolean;
  error: string | null;
  fetchCurrentShift: (options?: { registerId?: string }) => Promise<ShiftSummary | null>;
  openShift: (payload?: { openingBalance?: number; openingNote?: string }) => Promise<ShiftSummary | null>;
  closeShift: (payload?: { closingBalance?: number; closingNote?: string }) => Promise<ShiftSummary | null>;
}

export const useShiftStore = create<ShiftState>((set, get) => ({
  currentShift: null,
  loading: false,
  opening: false,
  closing: false,
  error: null,
  async fetchCurrentShift(options) {
    const registerId = options?.registerId ?? DEFAULT_POS_CONTEXT.registerId;
    set({ loading: true, error: null });
    try {
      const response = await api.get('/api/shifts/current', { params: { registerId } });
      const mapped = mapShift(response.data?.data);
      const nextShift = mapped?.status === 'open' ? mapped : null;
      set({ currentShift: nextShift });
      return nextShift;
    } catch (error) {
      set({ error: 'Не удалось загрузить смену', currentShift: null });
      throw error;
    } finally {
      set({ loading: false });
    }
  },
  async openShift(payload) {
    set({ opening: true });
    try {
      const response = await api.post('/api/shifts/open', {
        ...DEFAULT_POS_CONTEXT,
        ...(payload ?? {}),
      });
      const mapped = mapShift(response.data?.data);
      const nextShift = mapped?.status === 'open' ? mapped : null;
      set({ currentShift: nextShift, error: null });
      return nextShift;
    } catch (error) {
      throw error;
    } finally {
      set({ opening: false });
    }
  },
  async closeShift(payload) {
    const shiftId = get().currentShift?._id;
    if (!shiftId) {
      throw new Error('Нет открытой смены');
    }

    set({ closing: true });
    try {
      const response = await api.post(`/api/shifts/${shiftId}/close`, payload ?? {});
      const mapped = mapShift(response.data?.data);
      const nextShift = mapped?.status === 'open' ? mapped : null;
      set({ currentShift: nextShift });
      return mapped;
    } catch (error) {
      throw error;
    } finally {
      set({ closing: false });
    }
  },
}));
