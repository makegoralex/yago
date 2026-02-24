import { FilterQuery, isValidObjectId, Types } from 'mongoose';

import { OrderModel } from '../orders/order.model';
import { ShiftDocument, ShiftModel, ShiftTotals } from '../shifts/shift.model';

export interface SalesAndShiftFilter {
  organizationId: string;
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
  takeawayOrders: number;
  deliveryOrders: number;
  period?: {
    from?: string;
    to?: string;
  };
}

export interface DiscountAnalyticsFilter extends SalesAndShiftFilter {
  discountIds?: string[];
}

export interface DiscountAnalyticsStats {
  totalDiscountAmount: number;
  discountPercent: number;
  discountedOrdersCount: number;
  period?: {
    from?: string;
    to?: string;
  };
  selectedDiscountIds: string[];
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
  if (!filters.organizationId || !isValidObjectId(filters.organizationId)) {
    throw new Error('Organization context is required');
  }

  const organizationObjectId = new Types.ObjectId(filters.organizationId);

  const orderMatch: Record<string, unknown> = {
    status: { $in: ['paid', 'completed'] },
    organizationId: organizationObjectId,
  };

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
    OrderModel.aggregate<{ totalRevenue: number; totalOrders: number; takeawayOrders: number; deliveryOrders: number }>([
      { $match: orderMatch },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$total' },
          totalOrders: { $sum: 1 },
          takeawayOrders: {
            $sum: { $cond: [{ $eq: ['$orderTag', 'takeaway'] }, 1, 0] },
          },
          deliveryOrders: {
            $sum: { $cond: [{ $eq: ['$orderTag', 'delivery'] }, 1, 0] },
          },
        },
      },
    ]).then((result) => result[0]),
    ShiftModel.find({
      organizationId: organizationObjectId,
      ...buildDateRangeFilter('openedAt', filters.from, filters.to),
    })
      .sort({ openedAt: -1 })
      .lean(),
  ]);

  const totalRevenue = Number(orderStats?.totalRevenue ?? 0);
  const orderCount = orderStats?.totalOrders ?? 0;
  const averageOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;
  const takeawayOrders = orderStats?.takeawayOrders ?? 0;
  const deliveryOrders = orderStats?.deliveryOrders ?? 0;

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
    takeawayOrders,
    deliveryOrders,
    period,
  };
};

export const fetchDiscountAnalyticsStats = async (
  filters: DiscountAnalyticsFilter
): Promise<DiscountAnalyticsStats> => {
  if (!filters.organizationId || !isValidObjectId(filters.organizationId)) {
    throw new Error('Organization context is required');
  }

  const organizationObjectId = new Types.ObjectId(filters.organizationId);
  const orderMatch: Record<string, unknown> = {
    status: { $in: ['paid', 'completed'] },
    organizationId: organizationObjectId,
  };

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

  const selectedDiscountIds = (filters.discountIds ?? []).filter((id) => isValidObjectId(id));

  const discountAmountExpression =
    selectedDiscountIds.length > 0
      ? {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: '$appliedDiscounts',
                  as: 'discount',
                  cond: {
                    $in: [{ $toString: '$$discount.discountId' }, selectedDiscountIds],
                  },
                },
              },
              as: 'discount',
              in: { $ifNull: ['$$discount.amount', 0] },
            },
          },
        }
      : '$discount';

  const [stats] = await OrderModel.aggregate<{
    totalDiscountAmount: number;
    totalSubtotal: number;
    discountedOrdersCount: number;
  }>([
    { $match: orderMatch },
    {
      $project: {
        subtotal: { $ifNull: ['$subtotal', 0] },
        discountAmount: discountAmountExpression,
      },
    },
    {
      $group: {
        _id: null,
        totalDiscountAmount: { $sum: '$discountAmount' },
        totalSubtotal: { $sum: '$subtotal' },
        discountedOrdersCount: {
          $sum: {
            $cond: [{ $gt: ['$discountAmount', 0] }, 1, 0],
          },
        },
      },
    },
  ]);

  const totalDiscountAmount = Number(stats?.totalDiscountAmount ?? 0);
  const totalSubtotal = Number(stats?.totalSubtotal ?? 0);
  const discountPercent = totalSubtotal > 0 ? (totalDiscountAmount / totalSubtotal) * 100 : 0;

  const period =
    filters.from || filters.to
      ? {
          ...(filters.from ? { from: filters.from.toISOString() } : {}),
          ...(filters.to ? { to: filters.to.toISOString() } : {}),
        }
      : undefined;

  return {
    totalDiscountAmount,
    discountPercent,
    discountedOrdersCount: stats?.discountedOrdersCount ?? 0,
    period,
    selectedDiscountIds,
  };
};
