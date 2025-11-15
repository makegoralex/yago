import { FilterQuery } from 'mongoose';

import { OrderModel } from '../orders/order.model';
import { ShiftDocument, ShiftModel, ShiftStatus, ShiftTotals } from '../shifts/shift.model';

export interface SalesAndShiftFilter {
  from?: Date;
  to?: Date;
}

export interface ShiftSummary {
  id: string;
  cashierId: string;
  status: ShiftStatus;
  openedAt: Date;
  closedAt?: Date;
  totals: ShiftTotals;
}

export interface SalesAndShiftStats {
  orders: {
    totalOrders: number;
    totalRevenue: number;
  };
  shifts: ShiftSummary[];
}

const sanitizeTotals = (totals?: ShiftTotals | null): ShiftTotals => ({
  cash: totals?.cash ?? 0,
  card: totals?.card ?? 0,
  total: totals?.total ?? 0,
});

const buildDateRangeFilter = (
  field: keyof ShiftDocument,
  from?: Date,
  to?: Date
): FilterQuery<ShiftDocument> => {
  const filter: FilterQuery<ShiftDocument> = {};
  const range: Record<string, Date> = {};

  if (from) {
    range.$gte = from;
  }

  if (to) {
    range.$lte = to;
  }

  if (Object.keys(range).length > 0) {
    filter[field] = range as ShiftDocument[keyof ShiftDocument];
  }

  return filter;
};

export const fetchSalesAndShiftStats = async (
  filters: SalesAndShiftFilter
): Promise<SalesAndShiftStats> => {
  const orderMatch: Record<string, unknown> = { status: 'paid' };

  if (filters.from || filters.to) {
    const createdAt: Record<string, Date> = {};

    if (filters.from) {
      createdAt.$gte = filters.from;
    }

    if (filters.to) {
      createdAt.$lte = filters.to;
    }

    orderMatch.createdAt = createdAt;
  }

  const [orderStats, shifts] = await Promise.all([
    OrderModel.aggregate<{ totalRevenue: number; totalOrders: number }>([
      { $match: orderMatch },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$total' },
          totalOrders: { $sum: 1 },
        },
      },
    ]).then((result) => result[0]),
    ShiftModel.find({ ...buildDateRangeFilter('openedAt', filters.from, filters.to) })
      .sort({ openedAt: -1 })
      .lean(),
  ]);

  return {
    orders: {
      totalOrders: orderStats?.totalOrders ?? 0,
      totalRevenue: Number(orderStats?.totalRevenue ?? 0),
    },
    shifts: shifts.map((shift) => ({
      id: typeof (shift as { id?: string }).id === 'string' && (shift as { id?: string }).id
        ? (shift as { id: string }).id
        : shift._id.toString(),
      cashierId: shift.cashierId?.toString() ?? '',
      status: shift.status,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      totals: sanitizeTotals(shift.totals),
    })),
  };
};
