import fetch from 'node-fetch';
import { Types } from 'mongoose';

import { appConfig } from '../../config/env';
import { EvotorDeviceModel } from './evotor.model';
import type { OrderDocument } from '../orders/order.model';
import { OrderModel } from '../orders/order.model';
import { buildEvotorOrderSnapshot } from './orderTotals';
import { buildEvotorOrderItems } from './orderTotals';
import { EvotorSaleCommandModel, type EvotorSaleCommandDocument } from './evotorSaleCommand.model';

const EVOTOR_PUSH_URL = 'https://api.evotor.ru/api/apps';
const SALE_COMMAND_TTL_MS = 5 * 60 * 1000;

export type EvotorPushPayload = {
  type: 'order_sync';
  orderId: string;
  status: string;
  total: number;
  items: Array<{ name: string; qty: number; total: number }>;
  updatedAt: string;
};

export class EvotorEnqueueError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'EvotorEnqueueError';
  }
}

type EnqueueSaleCommandSkippedReason = 'zero_total';

type EnqueueSaleCommandSkippedResult = {
  skipped: true;
  reason: EnqueueSaleCommandSkippedReason;
  orderId: string;
};

type EnqueueSaleCommandCreatedResult = {
  skipped?: false;
  reused: boolean;
  command: EvotorSaleCommandDocument;
};

export type EnqueueSaleCommandResult = EnqueueSaleCommandSkippedResult | EnqueueSaleCommandCreatedResult;

const buildOrderPayload = (order: OrderDocument): EvotorPushPayload => ({
  type: 'order_sync',
  orderId: order._id.toString(),
  status: order.status,
  total: order.total,
  items: buildEvotorOrderSnapshot(order),
  updatedAt: order.updatedAt.toISOString(),
});

export const pushOrderToEvotor = async (order: OrderDocument): Promise<void> => {
  if (!appConfig.evotorPublisherToken || !appConfig.evotorAppUuid) {
    return;
  }

  const query: Record<string, unknown> = { organizationId: order.organizationId };
  if (order.registerId) {
    query.registerId = order.registerId;
  }

  const device = await EvotorDeviceModel.findOne(query).sort({ updatedAt: -1 });

  if (!device?.deviceUuid) {
    return;
  }

  const endpoint = `${EVOTOR_PUSH_URL}/${appConfig.evotorAppUuid}/devices/${device.deviceUuid}/push-notifications`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${appConfig.evotorPublisherToken}`,
    },
    body: JSON.stringify(buildOrderPayload(order)),
  });

  if (!response.ok) {
    const rawBody = await response.text();
    const errorSuffix = rawBody ? ` ${rawBody}` : '';
    throw new Error(`Evotor push failed: ${response.status} ${response.statusText}.${errorSuffix}`);
  }
};

export const enqueueSaleCommandForPaidOrder = async (
  organizationId: string,
  orderId: string,
  requestedByUserId?: string
): Promise<EnqueueSaleCommandResult> => {
  const normalizedOrganizationId = new Types.ObjectId(organizationId);
  const normalizedOrderId = new Types.ObjectId(orderId);

  const order = await OrderModel.findOne({
    _id: normalizedOrderId,
    organizationId: normalizedOrganizationId,
  }).select('_id status total items');

  if (!order) {
    throw new EvotorEnqueueError(404, 'Order not found');
  }

  if (order.status !== 'paid') {
    throw new EvotorEnqueueError(409, 'Only paid orders can be enqueued');
  }

  if (order.total <= 0) {
    return {
      skipped: true,
      reason: 'zero_total',
      orderId: order._id.toString(),
    };
  }

  const items = buildEvotorOrderItems(order.items ?? [], order.total);

  if (!items.length) {
    throw new EvotorEnqueueError(400, 'Order does not have valid items');
  }

  const now = new Date();
  const existing = await EvotorSaleCommandModel.findOne({
    organizationId: normalizedOrganizationId,
    orderId: order._id,
    status: 'pending',
    expiresAt: { $gt: now },
  }).sort({ createdAt: -1 });

  if (existing) {
    return {
      reused: true,
      command: existing,
    };
  }

  const command = await EvotorSaleCommandModel.create({
    organizationId: normalizedOrganizationId,
    orderId: order._id,
    requestedByUserId:
      requestedByUserId && Types.ObjectId.isValid(requestedByUserId)
        ? new Types.ObjectId(requestedByUserId)
        : undefined,
    orderSnapshot: {
      id: order._id.toString(),
      status: order.status,
      total: order.total,
      items,
    },
    status: 'pending',
    expiresAt: new Date(Date.now() + SALE_COMMAND_TTL_MS),
  });

  return {
    reused: false,
    command,
  };
};
