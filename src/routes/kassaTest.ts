import { Router, type Request } from 'express';
import net from 'net';
import fetch, { AbortError, FetchError } from 'node-fetch';

import { authMiddleware, requireRole } from '../middleware/auth';
import { enforceActiveSubscription } from '../middleware/subscription';

const REQUEST_TIMEOUT_MS = 7000;
const NETWORK_ERROR_CODES = new Set(['EHOSTUNREACH', 'ENETUNREACH', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND']);

const DEFAULT_HOST = process.env.KASSA_HOST || '192.168.0.139';
const DEFAULT_PORT = Number(process.env.KASSA_PORT || 5555);

const buildCompanyInfo = () => ({
  email: process.env.KASSA_EMAIL || 'admin@example.com',
  sno: process.env.KASSA_SNO || 'osn',
  inn: process.env.KASSA_INN || '000000000000',
  paymentAddress: process.env.KASSA_ADDRESS || 'Тестовая точка',
});

const parsePort = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    return DEFAULT_PORT;
  }

  return parsed;
};

const resolveConnectionParams = (req: Request) => {
  const hostCandidate = typeof req.query?.host === 'string' && req.query.host.trim() ? req.query.host.trim() : undefined;
  const portCandidate = typeof req.query?.port === 'string' && req.query.port.trim() ? req.query.port.trim() : undefined;

  return {
    host: hostCandidate || DEFAULT_HOST,
    port: parsePort(portCandidate ?? undefined),
  };
};

const buildSellPayload = (amount: number) => ({
  type: 'sell',
  request: {
    items: [
      {
        name: 'Тест подключения',
        price: amount,
        quantity: 1,
        paymentMethod: 'fullPayment',
        paymentObject: 'commodity',
        vat: { type: 'vat20' },
      },
    ],
    payments: [{ type: 1, sum: amount }],
    total: amount,
    company: buildCompanyInfo(),
  },
});

const extractRequestId = (response: Record<string, unknown>): string | undefined => {
  const maybeId = typeof response.uuid === 'string' ? response.uuid : undefined;
  if (maybeId) {
    return maybeId;
  }

  return typeof response.requestId === 'string' ? response.requestId : undefined;
};

const sendKassaRequest = async (
  host: string,
  port: number,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const url = `http://${host}:${port}/requests`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Касса ответила статусом ${response.status}`);
    }

    return (await response.json().catch(() => ({}))) as Record<string, unknown>;
  } catch (error) {
    if (error instanceof AbortError) {
      throw new Error('Истёк таймаут ожидания ответа от кассы');
    }

    if (error instanceof FetchError && error.code && NETWORK_ERROR_CODES.has(error.code)) {
      throw new Error(`Не удалось подключиться (${error.code}). Проверьте сеть/VPN и открытый порт.`);
    }

    throw error instanceof Error ? error : new Error('Ошибка запроса к кассе');
  } finally {
    clearTimeout(timeout);
  }
};

const fetchKassaRequest = async (
  host: string,
  port: number,
  requestId: string
): Promise<Record<string, unknown>> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const url = `http://${host}:${port}/requests/${encodeURIComponent(requestId)}`;

  try {
    const response = await fetch(url, { method: 'GET', signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Касса не вернула статус запроса ${requestId}`);
    }

    return (await response.json().catch(() => ({}))) as Record<string, unknown>;
  } catch (error) {
    if (error instanceof AbortError) {
      throw new Error('Не дождались ответа от кассы');
    }

    if (error instanceof FetchError && error.code && NETWORK_ERROR_CODES.has(error.code)) {
      throw new Error(`Не удалось получить ответ (${error.code}).`);
    }

    throw error instanceof Error ? error : new Error('Ошибка связи с кассой');
  } finally {
    clearTimeout(timeout);
  }
};

const checkTcpReachability = async (host: string, port: number): Promise<{ success: boolean; message?: string }> => {
  return await new Promise((resolve) => {
    const socket = new net.Socket();
    const onError = (message: string) => {
      socket.destroy();
      resolve({ success: false, message });
    };

    socket.setTimeout(3000);

    socket.connect(port, host, () => {
      socket.end();
      resolve({ success: true });
    });

    socket.on('timeout', () => onError('Касса не ответила (таймаут)'));
    socket.on('error', (err) => onError(err.message));
  });
};

const router = Router();

router.use(authMiddleware);
router.use(requireRole(['owner', 'superAdmin']));
router.use(enforceActiveSubscription);

router.get('/status', async (req, res) => {
  const { host, port } = resolveConnectionParams(req);
  const reachability = await checkTcpReachability(host, port);

  res.json({
    success: reachability.success,
    status: reachability.success ? 'connected' : 'error',
    message: reachability.message,
    ip: host,
    port,
    timestamp: new Date().toISOString(),
  });
});

router.get('/test-connection', async (req, res) => {
  const { host, port } = resolveConnectionParams(req);

  try {
    const salePayload = buildSellPayload(1);
    const initial = await sendKassaRequest(host, port, salePayload);
    const requestId = extractRequestId(initial);
    const followUp = requestId ? await fetchKassaRequest(host, port, requestId) : null;

    res.json({
      success: true,
      message: 'Касса подключена успешно',
      data: followUp ?? initial,
      config: { ip: host, port, status: 'active' },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      config: { ip: host, port, status: 'error' },
    });
  }
});

router.post('/print-test', async (req, res) => {
  const { host, port } = resolveConnectionParams(req);
  const amount = typeof req.body?.amount === 'number' ? req.body.amount : Number(req.body?.amount) || 100;
  const paymentType = typeof req.body?.paymentType === 'number' ? req.body.paymentType : Number(req.body?.paymentType) || 1;

  try {
    const payload = buildSellPayload(amount);
    payload.request.payments = [{ type: paymentType, sum: amount }];
    const initial = await sendKassaRequest(host, port, payload);
    const requestId = extractRequestId(initial);
    const followUp = requestId ? await fetchKassaRequest(host, port, requestId) : null;

    res.json({
      success: true,
      message: `Тестовый чек на ${amount}₽ отправлен`,
      data: followUp ?? initial,
      config: { ip: host, port, status: 'active' },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      config: { ip: host, port, status: 'error' },
    });
  }
});

export default router;
