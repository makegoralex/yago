import fetch from 'node-fetch';

import type { OrderDocument, OrderItem, PaymentMethod } from './order.model';

const EVOTOR_RECEIPTS_URL = 'https://partner.evotor.ru/api/v2/receipts';

type EvotorReceiptResponse = {
  id?: string;
  uuid?: string;
  receipt_id?: string;
  receiptId?: string;
};

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

const formatItemName = (item: OrderItem): string => {
  if (!item.modifiersApplied?.length) {
    return item.name;
  }

  const modifiers = item.modifiersApplied
    .map((modifier) => {
      const options = modifier.options.map((option) => option.name).filter(Boolean);
      return options.length ? `${modifier.groupName}: ${options.join(', ')}` : modifier.groupName;
    })
    .filter(Boolean);

  return modifiers.length ? `${item.name} (${modifiers.join('; ')})` : item.name;
};

const buildEvotorItems = (items: OrderItem[]) =>
  items.map((item) => {
    const itemTotal = roundCurrency(typeof item.total === 'number' ? item.total : item.price * item.qty);
    const unitPrice = item.qty > 0 ? roundCurrency(itemTotal / item.qty) : item.price;

    return {
      name: formatItemName(item),
      price: unitPrice,
      quantity: item.qty,
      sum: itemTotal,
      payment_method: 'full_payment',
      payment_object: 'commodity',
      tax: { type: 'none' },
    };
  });

const resolvePaymentType = (paymentMethod: PaymentMethod) =>
  paymentMethod === 'card' ? 'electronic' : 'cash';

const extractReceiptId = (payload: EvotorReceiptResponse | null): string | null => {
  if (!payload) {
    return null;
  }

  return payload.id ?? payload.receipt_id ?? payload.receiptId ?? payload.uuid ?? null;
};

export const sendEvotorReceipt = async ({
  order,
  paymentMethod,
  cloudToken,
  appToken,
}: {
  order: OrderDocument;
  paymentMethod: PaymentMethod;
  cloudToken: string;
  appToken?: string;
}): Promise<{ receiptId: string | null; response: EvotorReceiptResponse | null }> => {
  if (!cloudToken) {
    throw new Error('Evotor cloud token is required');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Authorization': cloudToken,
  };

  if (appToken) {
    headers.Authorization = `Bearer ${appToken}`;
  }

  const payload = {
    external_id: order._id.toString(),
    device_id: order.registerId,
    receipt: {
      type: 'sell',
      items: buildEvotorItems(order.items),
      payments: [
        {
          type: resolvePaymentType(paymentMethod),
          sum: roundCurrency(order.total),
        },
      ],
      total: roundCurrency(order.total),
    },
  };

  const response = await fetch(EVOTOR_RECEIPTS_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const rawBody = await response.text();
  let parsedBody: EvotorReceiptResponse | null = null;
  if (rawBody) {
    try {
      parsedBody = JSON.parse(rawBody) as EvotorReceiptResponse;
    } catch (error) {
      parsedBody = null;
    }
  }

  if (!response.ok) {
    const errorSuffix = rawBody ? ` ${rawBody}` : '';
    throw new Error(`Evotor receipt request failed: ${response.status} ${response.statusText}.${errorSuffix}`);
  }

  return {
    receiptId: extractReceiptId(parsedBody),
    response: parsedBody,
  };
};
