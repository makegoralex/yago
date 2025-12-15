import { Types } from 'mongoose';

import { FiscalDeviceDocument, FiscalDeviceModel, FiscalDeviceShiftState, FiscalDeviceStatus } from './fiscalDevice.model';

export class FiscalDeviceError extends Error {
  constructor(message: string, public readonly status: number = 400) {
    super(message);
    this.name = 'FiscalDeviceError';
  }
}

export const FISCAL_TAX_SYSTEMS = [
  'osn',
  'usn_income',
  'usn_income_outcome',
  'envd',
  'esn',
  'patent',
] as const;

const IP_REGEXP = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/;

const validateIpAddress = (value: string): boolean => IP_REGEXP.test(value.trim());

const validatePort = (value: number): boolean => Number.isInteger(value) && value > 0 && value <= 65535;

const normalizeString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const normalizeTaxationSystem = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const match = FISCAL_TAX_SYSTEMS.find((system) => system === trimmed);
  return match ?? undefined;
};

const normalizeVatin = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (!/^\d{10,12}$/.test(trimmed)) {
    throw new FiscalDeviceError('ИНН оператора должен содержать 10–12 цифр');
  }

  return trimmed;
};

const buildOrgId = (organizationId: Types.ObjectId): string => organizationId.toString();

const findDeviceById = async (
  id: string,
  organizationId?: Types.ObjectId | null
): Promise<FiscalDeviceDocument> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new FiscalDeviceError('Некорректный идентификатор устройства');
  }

  const match: Record<string, unknown> = { _id: new Types.ObjectId(id) };

  if (organizationId) {
    match.organizationId = organizationId;
  }

  const device = await FiscalDeviceModel.findOne(match);

  if (!device) {
    throw new FiscalDeviceError('Устройство не найдено или принадлежит другой организации', 404);
  }

  return device;
};

export const listFiscalDevices = async (
  organizationId: Types.ObjectId
): Promise<FiscalDeviceDocument[]> => {
  return FiscalDeviceModel.find({ organizationId }).sort({ createdAt: -1 });
};

export const createFiscalDevice = async (params: {
  organizationId: Types.ObjectId;
  name: string;
  ip: string;
  port: number;
  taxationSystem?: unknown;
  operatorName?: unknown;
  operatorVatin?: unknown;
  auth?: { login?: unknown; password?: unknown };
}): Promise<FiscalDeviceDocument> => {
  const name = normalizeString(params.name);
  const ip = normalizeString(params.ip);
  const port = Number(params.port);
  const operatorName = normalizeString(params.operatorName);
  const operatorVatin = normalizeVatin(params.operatorVatin);
  const taxationSystem = normalizeTaxationSystem(params.taxationSystem);

  if (!name) {
    throw new FiscalDeviceError('Название кассы обязательно');
  }

  if (!ip || !validateIpAddress(ip)) {
    throw new FiscalDeviceError('Укажите корректный IP-адрес кассы');
  }

  if (!validatePort(port)) {
    throw new FiscalDeviceError('Порт кассы должен быть в диапазоне 1-65535');
  }

  const authLogin = normalizeString(params.auth?.login);
  const authPassword = normalizeString(params.auth?.password);

  const device = await FiscalDeviceModel.create({
    orgId: buildOrgId(params.organizationId),
    organizationId: params.organizationId,
    name,
    ip,
    port,
    taxationSystem,
    operatorName: operatorName || undefined,
    operatorVatin,
    status: 'unknown',
    auth: authLogin || authPassword ? { login: authLogin || undefined, password: authPassword || undefined } : undefined,
  });

  return device;
};

export const updateFiscalDevice = async (params: {
  id: string;
  organizationId: Types.ObjectId;
  name?: unknown;
  ip?: unknown;
  port?: unknown;
  taxationSystem?: unknown;
  operatorName?: unknown;
  operatorVatin?: unknown;
  auth?: { login?: unknown; password?: unknown };
}): Promise<FiscalDeviceDocument> => {
  const device = await findDeviceById(params.id, params.organizationId);

  if (params.name !== undefined) {
    const name = normalizeString(params.name);
    if (!name) {
      throw new FiscalDeviceError('Название кассы обязательно');
    }
    device.name = name;
  }

  if (params.ip !== undefined) {
    const ip = normalizeString(params.ip);
    if (!ip || !validateIpAddress(ip)) {
      throw new FiscalDeviceError('Укажите корректный IP-адрес кассы');
    }
    device.ip = ip;
  }

  if (params.port !== undefined) {
    const port = Number(params.port);
    if (!validatePort(port)) {
      throw new FiscalDeviceError('Порт кассы должен быть в диапазоне 1-65535');
    }
    device.port = port;
  }

  if (params.operatorName !== undefined) {
    device.operatorName = normalizeString(params.operatorName) || undefined;
  }

  if (params.operatorVatin !== undefined) {
    device.operatorVatin = normalizeVatin(params.operatorVatin);
  }

  if (params.taxationSystem !== undefined) {
    device.taxationSystem = normalizeTaxationSystem(params.taxationSystem);
  }

  if (params.auth !== undefined) {
    const login = normalizeString(params.auth?.login);
    const password = normalizeString(params.auth?.password);
    device.auth = login || password ? { login: login || undefined, password: password || undefined } : undefined;
  }

  await device.save();
  return device;
};

export const deleteFiscalDevice = async (
  id: string,
  organizationId: Types.ObjectId
): Promise<void> => {
  const device = await findDeviceById(id, organizationId);
  await device.deleteOne();
};

type DeviceRequestPayload = Record<string, unknown>;

type DeviceResponse = {
  uuid?: string;
  status?: string;
  payload?: unknown;
  error?: string;
  [key: string]: unknown;
};

const buildHeaders = (device: FiscalDeviceDocument): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (device.auth?.login && device.auth?.password) {
    const encoded = Buffer.from(`${device.auth.login}:${device.auth.password}`).toString('base64');
    headers.Authorization = `Basic ${encoded}`;
  }

  return headers;
};

const sendDeviceRequest = async (
  device: FiscalDeviceDocument,
  payload: DeviceRequestPayload
): Promise<DeviceResponse> => {
  const url = `http://${device.ip}:${device.port}/requests`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(device),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new FiscalDeviceError(`Касса ответила ошибкой ${response.status}`);
  }

  return (await response.json().catch(() => ({}))) as DeviceResponse;
};

const fetchDeviceRequest = async (
  device: FiscalDeviceDocument,
  requestId: string
): Promise<DeviceResponse> => {
  const url = `http://${device.ip}:${device.port}/requests/${encodeURIComponent(requestId)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(device),
  });

  if (!response.ok) {
    throw new FiscalDeviceError(`Не удалось получить статус запроса ${requestId}`);
  }

  return (await response.json().catch(() => ({}))) as DeviceResponse;
};

const extractRequestId = (response: DeviceResponse): string | undefined => {
  if (typeof response?.uuid === 'string' && response.uuid) {
    return response.uuid;
  }

  if (typeof response?.requestId === 'string' && response.requestId) {
    return response.requestId;
  }

  const nestedUuid = (response as { data?: { uuid?: string } })?.data?.uuid;
  if (typeof nestedUuid === 'string' && nestedUuid) {
    return nestedUuid;
  }

  return undefined;
};

const extractShiftState = (payload: DeviceResponse): FiscalDeviceShiftState | undefined => {
  const shiftState = (payload as { shiftState?: unknown }).shiftState;
  if (typeof shiftState === 'string') {
    if (shiftState === 'open' || shiftState === 'closed' || shiftState === 'unknown') {
      return shiftState;
    }
  }

  const nestedShift = (payload as { data?: { shiftState?: unknown } })?.data?.shiftState;
  if (typeof nestedShift === 'string') {
    if (nestedShift === 'open' || nestedShift === 'closed' || nestedShift === 'unknown') {
      return nestedShift;
    }
  }

  return undefined;
};

const updateDeviceHealth = async (
  device: FiscalDeviceDocument,
  status: FiscalDeviceStatus,
  shiftState?: FiscalDeviceShiftState,
  lastError?: string
): Promise<FiscalDeviceDocument> => {
  const updates: Partial<FiscalDeviceDocument> = {
    status,
    lastPing: new Date(),
    lastError,
  };

  if (shiftState) {
    updates.lastShiftState = shiftState;
  }

  await FiscalDeviceModel.updateOne({ _id: device._id }, updates);
  const updated = await FiscalDeviceModel.findById(device._id);
  return updated ?? device;
};

const performDeviceOperation = async (
  device: FiscalDeviceDocument,
  command: string,
  payload: DeviceRequestPayload = {}
): Promise<{ device: FiscalDeviceDocument; requestId?: string; response: DeviceResponse }> => {
  try {
    const requestPayload = {
      command,
      ...payload,
    } as DeviceRequestPayload;

    const response = await sendDeviceRequest(device, requestPayload);
    const requestId = extractRequestId(response);

    let finalResponse = response;
    if (requestId) {
      try {
        finalResponse = await fetchDeviceRequest(device, requestId);
      } catch (error) {
        finalResponse = response;
        console.warn('Не удалось получить финальный ответ кассы', error);
      }
    }

    const shiftState = extractShiftState(finalResponse) ?? extractShiftState(response);
    const updatedDevice = await updateDeviceHealth(device, 'online', shiftState, undefined);

    return { device: updatedDevice, requestId, response: finalResponse };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка связи с кассой';
    await updateDeviceHealth(device, 'error', undefined, message);
    if (error instanceof FiscalDeviceError) {
      throw error;
    }
    throw new FiscalDeviceError(message);
  }
};

export const getShiftStatus = async (
  id: string,
  organizationId: Types.ObjectId
): Promise<{ device: FiscalDeviceDocument; requestId?: string; response: DeviceResponse }> => {
  const device = await findDeviceById(id, organizationId);
  return performDeviceOperation(device, 'getShiftStatus');
};

export const openShift = async (
  id: string,
  organizationId: Types.ObjectId
): Promise<{ device: FiscalDeviceDocument; requestId?: string; response: DeviceResponse }> => {
  const device = await findDeviceById(id, organizationId);
  return performDeviceOperation(device, 'openShift', {
    operator: {
      name: device.operatorName,
      vatin: device.operatorVatin,
    },
  });
};

export const closeShift = async (
  id: string,
  organizationId: Types.ObjectId
): Promise<{ device: FiscalDeviceDocument; requestId?: string; response: DeviceResponse }> => {
  const device = await findDeviceById(id, organizationId);
  return performDeviceOperation(device, 'closeShift');
};

export const sendXReport = async (
  id: string,
  organizationId: Types.ObjectId
): Promise<{ device: FiscalDeviceDocument; requestId?: string; response: DeviceResponse }> => {
  const device = await findDeviceById(id, organizationId);
  return performDeviceOperation(device, 'xReport');
};

export const sellTestReceipt = async (
  id: string,
  organizationId: Types.ObjectId
): Promise<{ device: FiscalDeviceDocument; requestId?: string; response: DeviceResponse }> => {
  const device = await findDeviceById(id, organizationId);
  const total = 100;
  return performDeviceOperation(device, 'sell', {
    taxationSystem: device.taxationSystem ?? 'osn',
    operator: {
      name: device.operatorName,
      vatin: device.operatorVatin,
    },
    items: [
      {
        name: 'Тестовый товар',
        price: total,
        quantity: 1,
        amount: total,
        vat: { type: 'none' },
      },
    ],
    payments: [
      {
        type: 'cash',
        sum: total,
      },
    ],
    total,
  });
};
