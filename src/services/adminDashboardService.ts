import { FilterQuery } from 'mongoose';

import { OrderModel, OrderStatus } from '../modules/orders/order.model';
import { ShiftDocument, ShiftModel } from '../modules/shifts/shift.model';

const REVENUE_STATUSES: OrderStatus[] = ['paid', 'completed'];

const roundTwoDecimals = (value: number): number =>
  Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

export interface SalesAndShiftStatsParams {
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
}

const buildDateRangeFilter = (
  field: keyof ShiftDocument,
  from?: Date,
  to?: Date,
  ensureExists = false
): FilterQuery<ShiftDocument> => {
  const filter: FilterQuery<ShiftDocument> = {};
  const range: Record<string, Date | null> = {};

  if (from) {
    range.$gte = from;
  }

  if (to) {
    range.$lt = to;
  }

  if (Object.keys(range).length > 0) {
    filter[field] = range as unknown as ShiftDocument[keyof ShiftDocument];
  }

  if (ensureExists) {
    const currentField = filter[field];
    filter[field] = {
      ...(typeof currentField === 'object' && currentField !== null ? currentField : {}),
      $ne: null,
    } as unknown as ShiftDocument[keyof ShiftDocument];
  }

  return filter;
};

export const getSalesAndShiftStats = async (
  params: SalesAndShiftStatsParams
): Promise<SalesAndShiftStats> => {
  const orderMatch: Record<string, unknown> = { status: { $in: REVENUE_STATUSES } };

  if (params.from || params.to) {
    const createdAtRange: Record<string, Date> = {};

    if (params.from) {
      createdAtRange.$gte = params.from;
    }

    if (params.to) {
      createdAtRange.$lt = params.to;
    }

    orderMatch.createdAt = createdAtRange;
  }

  const [orderStats] = await OrderModel.aggregate<{
    totalRevenue: number;
    orderCount: number;
  }>([
    { $match: orderMatch },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$total' },
        orderCount: { $sum: 1 },
      },
    },
  ]);

  const totalRevenue = roundTwoDecimals(orderStats?.totalRevenue ?? 0);
  const orderCount = orderStats?.orderCount ?? 0;
  const averageOrderValue =
    orderCount > 0 ? roundTwoDecimals(totalRevenue / orderCount) : 0;

  const openedFilter = buildDateRangeFilter('openedAt', params.from, params.to);
  const closedFilter = buildDateRangeFilter('closedAt', params.from, params.to, true);

  const [openShiftCount, closedShiftCount, currentOpenShiftCount] = await Promise.all([
    ShiftModel.countDocuments(openedFilter),
    ShiftModel.countDocuments(closedFilter),
    ShiftModel.countDocuments({ status: 'open' }),
  ]);

  const averageRevenuePerClosedShift =
    closedShiftCount > 0 ? roundTwoDecimals(totalRevenue / closedShiftCount) : 0;

  return {
    totalRevenue,
    orderCount,
    averageOrderValue,
    openShiftCount,
    closedShiftCount,
    currentOpenShiftCount,
    averageRevenuePerClosedShift,
  };
};
