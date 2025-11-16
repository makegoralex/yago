import { FilterQuery } from 'mongoose';

import { OrderModel } from '../orders/order.model';
import { ShiftDocument, ShiftModel, ShiftTotals } from '../shifts/shift.model';

export interface SalesAndShiftFilter {
  from?: Date;
  to?: Date;
}

export interface SalesAndShiftStats {
  totalRevenue: number;
  orderCount: number;
  averageOrderValue: number;
  openShiftCount: number;
  closedShiftCount: number;
  currentOpenShiftCount: number;
  averageRevenuePerClosedShift: number;
  period?: {
    from?: string;
    to?: string;
  };
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

  const totalRevenue = Number(orderStats?.totalRevenue ?? 0);
  const orderCount = orderStats?.totalOrders ?? 0;
  const averageOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

  let openShiftCount = 0;
  let closedShiftCount = 0;
  let totalClosedShiftRevenue = 0;

  for (const shift of shifts) {
    const totals = sanitizeTotals(shift.totals);
    if (shift.status === 'open') {
      openShiftCount += 1;
    }

    if (shift.status === 'closed') {
      closedShiftCount += 1;
      totalClosedShiftRevenue += totals.total;
    }
  }

  const averageRevenuePerClosedShift =
    closedShiftCount > 0 ? totalClosedShiftRevenue / closedShiftCount : 0;

  const period =
    filters.from || filters.to
      ? {
          ...(filters.from ? { from: filters.from.toISOString() } : {}),
          ...(filters.to ? { to: filters.to.toISOString() } : {}),
        }
      : undefined;

  return {
    totalRevenue,
    orderCount,
    averageOrderValue,
    openShiftCount,
    closedShiftCount,
    currentOpenShiftCount: openShiftCount,
    averageRevenuePerClosedShift,
    period,
  };
};
