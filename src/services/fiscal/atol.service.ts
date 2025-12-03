import { OrganizationSettings } from '../../models/Organization';
import { PaymentMethod } from '../../modules/orders/order.model';

export type AtolMode = 'test' | 'prod';

export interface AtolCredentials {
  login: string;
  password: string;
  groupCode: string;
  inn: string;
  paymentAddress: string;
  deviceId?: string;
}

export interface AtolReceiptItem {
  name: string;
  price: number;
  quantity: number;
  sum: number;
}

export interface FiscalizationResult {
  status: 'registered' | 'pending';
  receiptId?: string;
}

const API_VERSION = 'v4';

const getBaseUrl = (mode: AtolMode): string => {
  const host = mode === 'prod' ? 'https://online.atol.ru/possystem' : 'https://testonline.atol.ru/possystem';
  return `${host}/${API_VERSION}`;
};

const requestToken = async (mode: AtolMode, credentials: AtolCredentials): Promise<string> => {
  const baseUrl = getBaseUrl(mode);
  const response = await fetch(`${baseUrl}/getToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: credentials.login, pass: credentials.password }),
  });

  const payload = (await response.json().catch(() => ({}))) as { code?: number; token?: string; error?: { text?: string } };

  if (!response.ok || !payload.token) {
    const message = payload.error?.text || `ATOL auth failed (${response.status})`;
    throw new Error(message);
  }

  return payload.token;
};

const mapPaymentMethod = (method: PaymentMethod): number => (method === 'cash' ? 0 : 1);

const buildReceiptPayload = (
  credentials: AtolCredentials,
  items: AtolReceiptItem[],
  paymentMethod: PaymentMethod,
  total: number,
  externalId?: string
) => ({
  external_id: externalId,
  timestamp: new Date().toISOString(),
  service: {
    payment_address: credentials.paymentAddress,
    inn: credentials.inn,
    device_id: credentials.deviceId,
  },
  receipt: {
    client: {},
    company: {
      inn: credentials.inn,
      payment_address: credentials.paymentAddress,
      sno: 'osn',
    },
    items: items.map((item) => ({
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      sum: item.sum,
      payment_method: 'full_payment',
      payment_object: 'service',
    })),
    payments: [
      {
        type: mapPaymentMethod(paymentMethod),
        sum: total,
      },
    ],
    total,
  },
});

const sendReceiptRequest = async (
  mode: AtolMode,
  credentials: AtolCredentials,
  payload: unknown
): Promise<FiscalizationResult> => {
  const token = await requestToken(mode, credentials);
  const baseUrl = getBaseUrl(mode);
  const response = await fetch(`${baseUrl}/${credentials.groupCode}/sell?tokenid=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => ({}))) as {
    uuid?: string;
    status?: string;
    payload?: { uuid?: string; status?: string };
    error?: { text?: string };
  };

  if (!response.ok || body.error) {
    const message = body.error?.text || `ATOL receipt error (${response.status})`;
    throw new Error(message);
  }

  const statusText = body.status || body.payload?.status || 'pending';
  const receiptId = body.uuid || body.payload?.uuid;
  const normalizedStatus: 'registered' | 'pending' =
    statusText === 'done' || statusText === 'ready' ? 'registered' : 'pending';

  return { status: normalizedStatus, receiptId };
};

export const getFiscalProviderFromSettings = (settings?: OrganizationSettings | null) => settings?.fiscalProvider;

export const sendAtolReceipt = async (options: {
  mode: AtolMode;
  credentials: AtolCredentials;
  items: AtolReceiptItem[];
  paymentMethod: PaymentMethod;
  total: number;
  externalId?: string;
}): Promise<FiscalizationResult> => {
  const payload = buildReceiptPayload(options.credentials, options.items, options.paymentMethod, options.total, options.externalId);
  return sendReceiptRequest(options.mode, options.credentials, payload);
};

export const sendAtolTestReceipt = async (mode: AtolMode, credentials: AtolCredentials) => {
  const payload = buildReceiptPayload(
    credentials,
    [
      {
        name: 'Тестовый чек',
        price: 1,
        quantity: 1,
        sum: 1,
      },
    ],
    'card',
    1,
    `test-${Date.now()}`
  );

  return sendReceiptRequest(mode, credentials, payload);
};
