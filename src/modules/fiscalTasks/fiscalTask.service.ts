import { Types } from 'mongoose';

import { FiscalDeviceModel } from '../fiscalDevices/fiscalDevice.model';
import { FiscalTaskDocument, FiscalTaskModel, FiscalTaskStatus } from './fiscalTask.model';

export class FiscalTaskError extends Error {
  constructor(message: string, public readonly status: number = 400) {
    super(message);
    this.name = 'FiscalTaskError';
  }
}

const normalizeObjectId = (value: unknown, field: string): Types.ObjectId => {
  if (typeof value !== 'string' || !Types.ObjectId.isValid(value)) {
    throw new FiscalTaskError(`${field} is required`);
  }

  return new Types.ObjectId(value);
};

const normalizeStatus = (value: unknown): FiscalTaskStatus => {
  if (typeof value !== 'string') {
    throw new FiscalTaskError('Status is required');
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new FiscalTaskError('Status is required');
  }

  if (!['queued', 'in_progress', 'done', 'error'].includes(normalized)) {
    throw new FiscalTaskError('Unsupported status');
  }

  return normalized as FiscalTaskStatus;
};

const normalizeFnCode = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized || undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
};

const normalizeErrorMessage = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
};

export const createFiscalTask = async (params: {
  organizationId: unknown;
  fiscalDeviceId: unknown;
  type: unknown;
  payload: unknown;
}): Promise<FiscalTaskDocument> => {
  const organizationId = normalizeObjectId(params.organizationId, 'organizationId');
  const fiscalDeviceId = normalizeObjectId(params.fiscalDeviceId, 'fiscalDeviceId');

  const type = typeof params.type === 'string' ? params.type.trim() : '';
  if (!type) {
    throw new FiscalTaskError('type is required');
  }

  if (params.payload === null || params.payload === undefined || typeof params.payload !== 'object') {
    throw new FiscalTaskError('payload is required');
  }

  const device = await FiscalDeviceModel.findOne({ _id: fiscalDeviceId, organizationId }).select('_id');
  if (!device) {
    throw new FiscalTaskError('Fiscal device not found for organization', 404);
  }

  return FiscalTaskModel.create({
    organizationId,
    fiscalDeviceId,
    type,
    payload: params.payload,
    status: 'queued',
    attempts: 0,
  });
};

export const fetchNextFiscalTask = async (params: {
  organizationId: unknown;
  fiscalDeviceId: unknown;
}): Promise<FiscalTaskDocument | null> => {
  const organizationId = normalizeObjectId(params.organizationId, 'organizationId');
  const fiscalDeviceId = normalizeObjectId(params.fiscalDeviceId, 'fiscalDeviceId');

  const task = await FiscalTaskModel.findOneAndUpdate(
    {
      organizationId,
      fiscalDeviceId,
      status: 'queued',
    },
    {
      $set: { status: 'in_progress', startedAt: new Date(), completedAt: undefined },
      $inc: { attempts: 1 },
    },
    { sort: { createdAt: 1 }, new: true }
  );

  if (task && task.attempts > 1) {
    console.warn('Fiscal task retry detected', {
      taskId: task.id,
      attempts: task.attempts,
      fiscalDeviceId: task.fiscalDeviceId.toString(),
    });
  }

  return task;
};

export const updateFiscalTaskStatus = async (params: {
  id: string;
  status: unknown;
  fnCode?: unknown;
  error?: unknown;
}): Promise<FiscalTaskDocument> => {
  if (!Types.ObjectId.isValid(params.id)) {
    throw new FiscalTaskError('Invalid task id');
  }

  const status = normalizeStatus(params.status);
  const fnCode = normalizeFnCode(params.fnCode);
  const errorMessage = normalizeErrorMessage(params.error);

  const task = await FiscalTaskModel.findById(params.id);
  if (!task) {
    throw new FiscalTaskError('Fiscal task not found', 404);
  }

  const now = new Date();

  task.status = status;
  task.fnCode = fnCode;

  if (status === 'queued') {
    task.startedAt = undefined;
    task.completedAt = undefined;
  }

  if (status === 'in_progress') {
    task.startedAt = now;
    task.completedAt = undefined;
    task.attempts += 1;
  }

  if (status === 'done') {
    task.completedAt = now;
  }

  if (status === 'error') {
    task.completedAt = undefined;
  }

  if (errorMessage) {
    task.error = errorMessage;
    console.error('Fiscal task error', { taskId: task.id, error: errorMessage });
  } else if (status !== 'error') {
    task.error = undefined;
  }

  if (task.attempts > 1 && status === 'in_progress') {
    console.warn('Fiscal task retry detected', {
      taskId: task.id,
      attempts: task.attempts,
      fiscalDeviceId: task.fiscalDeviceId.toString(),
    });
  }

  await task.save();

  return task;
};
