import { Types } from 'mongoose';

import { CustomerModel } from '../modules/customers/customer.model';
import {
  OrderModel,
  type OrderStatus,
} from '../modules/orders/order.model';

const REVENUE_STATUSES: OrderStatus[] = ['paid', 'fiscalized'];

const roundTwoDecimals = (value: number): number =>
  Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

export interface SummaryReport {
  totalOrders: number;
  totalRevenue: number;
  avgCheck: number;
  totalCustomers: number;
  totalPointsIssued: number;
  totalPointsRedeemed: number;
}

export interface DailyReportEntry {
  date: string;
  totalRevenue: number;
  orderCount: number;
}

export interface TopProductEntry {
  productId: string;
  name: string;
  totalQuantity: number;
  totalRevenue: number;
}

export interface TopCustomerEntry {
  customerId: string;
  name: string;
  phone: string;
  email?: string;
  totalSpent: number;
  pointsBalance: number;
}

export const getSummaryReport = async (): Promise<SummaryReport> => {
  const [orderStats] = await OrderModel.aggregate<{
    totalOrders: number;
    totalRevenue: number;
  }>([
    { $match: { status: { $in: REVENUE_STATUSES } } },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$totals.grandTotal' },
      },
    },
  ]);

  const [customerStats] = await CustomerModel.aggregate<{
    totalCustomers: number;
    totalPointsBalance: number;
    totalSpent: number;
  }>([
    {
      $group: {
        _id: null,
        totalCustomers: { $sum: 1 },
        totalPointsBalance: { $sum: '$points' },
        totalSpent: { $sum: '$totalSpent' },
      },
    },
  ]);

  const totalOrders = orderStats?.totalOrders ?? 0;
  const totalRevenue = roundTwoDecimals(orderStats?.totalRevenue ?? 0);
  const avgCheck = totalOrders > 0 ? roundTwoDecimals(totalRevenue / totalOrders) : 0;

  const totalCustomers = customerStats?.totalCustomers ?? 0;
  const totalSpent = customerStats?.totalSpent ?? 0;
  const totalPointsBalance = customerStats?.totalPointsBalance ?? 0;
  const totalPointsIssued = roundTwoDecimals(totalSpent * 0.05);
  const totalPointsRedeemed = roundTwoDecimals(
    Math.max(totalPointsIssued - totalPointsBalance, 0)
  );

  return {
    totalOrders,
    totalRevenue,
    avgCheck,
    totalCustomers,
    totalPointsIssued,
    totalPointsRedeemed,
  };
};

interface DailyReportParams {
  from?: Date;
  to?: Date;
}

export const getDailyReport = async (
  params: DailyReportParams
): Promise<DailyReportEntry[]> => {
  const matchStage: Record<string, unknown> = {
    status: { $in: REVENUE_STATUSES },
  };

  if (params.from || params.to) {
    const createdAtMatch: Record<string, Date> = {};

    if (params.from) {
      createdAtMatch.$gte = params.from;
    }

    if (params.to) {
      createdAtMatch.$lt = params.to;
    }

    matchStage.createdAt = createdAtMatch;
  }

  const daily = await OrderModel.aggregate<{
    _id: string;
    revenue: number;
    orders: number;
  }>([
    { $match: matchStage },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$createdAt',
          },
        },
        revenue: { $sum: '$totals.grandTotal' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return daily.map((entry) => ({
    date: entry._id,
    totalRevenue: roundTwoDecimals(entry.revenue ?? 0),
    orderCount: entry.orders ?? 0,
  }));
};

export const getTopProducts = async (
  limit: number
): Promise<TopProductEntry[]> => {
  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 5;

  const products = await OrderModel.aggregate<{
    _id: Types.ObjectId | null;
    name: string;
    totalQuantity: number;
    totalRevenue: number;
  }>([
    { $match: { status: { $in: REVENUE_STATUSES } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.productId',
        name: { $first: '$items.name' },
        totalQuantity: { $sum: '$items.qty' },
        totalRevenue: { $sum: '$items.total' },
      },
    },
    { $sort: { totalQuantity: -1, totalRevenue: -1 } },
    { $limit: normalizedLimit },
  ]);

  return products.map((product) => ({
    productId: product._id ? product._id.toString() : 'unknown',
    name: product.name,
    totalQuantity: product.totalQuantity ?? 0,
    totalRevenue: roundTwoDecimals(product.totalRevenue ?? 0),
  }));
};

export const getTopCustomers = async (
  limit: number
): Promise<TopCustomerEntry[]> => {
  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 5;

  const customers = await CustomerModel.aggregate<{
    _id: Types.ObjectId;
    name: string;
    phone: string;
    email?: string;
    totalSpent: number;
    points: number;
  }>([
    {
      $project: {
        name: 1,
        phone: 1,
        email: 1,
        totalSpent: 1,
        points: 1,
      },
    },
    { $sort: { totalSpent: -1 } },
    { $limit: normalizedLimit },
  ]);

  return customers.map((customer) => ({
    customerId: customer._id.toString(),
    name: customer.name,
    phone: customer.phone,
    email: customer.email ?? undefined,
    totalSpent: roundTwoDecimals(customer.totalSpent ?? 0),
    pointsBalance: roundTwoDecimals(customer.points ?? 0),
  }));
};
