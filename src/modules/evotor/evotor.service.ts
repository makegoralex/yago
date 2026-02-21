import fetch from 'node-fetch';

import { appConfig } from '../../config/env';
import { EvotorDeviceModel } from './evotor.model';
import type { OrderDocument } from '../orders/order.model';
import { buildEvotorOrderSnapshot } from './orderTotals';

const EVOTOR_PUSH_URL = 'https://api.evotor.ru/api/apps';

export type EvotorPushPayload = {
  type: 'order_sync';
  orderId: string;
  status: string;
  total: number;
  items: Array<{ name: string; qty: number; total: number }>;
  updatedAt: string;
};

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
