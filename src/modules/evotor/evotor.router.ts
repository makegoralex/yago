import { Router } from 'express';
import { Types } from 'mongoose';

import { authMiddleware, requireRole } from '../../middleware/auth';
import { EvotorDeviceModel } from './evotor.model';
import { appConfig } from '../../config/env';
const asyncHandler =
  (fn: (req: any, res: any) => Promise<void>) =>
  (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res)).catch(next);

const evotorRouter = Router();

const ensureWebhookAuth = (authorization: string | undefined): boolean => {
  if (!appConfig.evotorWebhookSecret) {
    return true;
  }

  if (!authorization) {
    return false;
  }

  const expectedBearer = `Bearer ${appConfig.evotorWebhookSecret}`;
  const expectedBasic = `Basic ${appConfig.evotorWebhookSecret}`;

  return authorization === expectedBearer || authorization === expectedBasic;
};

evotorRouter.post(
  '/token',
  asyncHandler(async (req, res) => {
    if (!ensureWebhookAuth(req.headers.authorization)) {
      res.status(401).json({ data: null, error: 'Unauthorized' });
      return;
    }

    const payload = req.body ?? {};
    const user = payload.user ?? {};
    const token = typeof payload.token === 'string' ? payload.token : '';

    if (!token) {
      res.status(400).json({ data: null, error: 'Token is required' });
      return;
    }

    const userId = typeof user.id === 'string' ? user.id : undefined;
    const inn = typeof user.inn === 'string' ? user.inn : undefined;
    const deviceUuid = typeof payload.device_uuid === 'string' ? payload.device_uuid : undefined;
    const storeUuid = typeof payload.store_uuid === 'string' ? payload.store_uuid : undefined;

    const update = {
      userId,
      inn,
      userToken: token,
      deviceUuid,
      storeUuid,
      appUuid: appConfig.evotorAppUuid,
    };

    const doc = await EvotorDeviceModel.findOneAndUpdate(
      { userId, appUuid: appConfig.evotorAppUuid },
      update,
      { upsert: true, new: true }
    );

    res.json({ data: { id: doc._id }, error: null });
  })
);

evotorRouter.post(
  '/devices/link',
  authMiddleware,
  requireRole(['owner', 'superAdmin']),
  asyncHandler(async (req, res) => {
    const { deviceUuid, registerId } = req.body ?? {};
    const organizationId = req.user?.organizationId;

    if (!organizationId || !Types.ObjectId.isValid(organizationId)) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    if (!deviceUuid || typeof deviceUuid !== 'string') {
      res.status(400).json({ data: null, error: 'deviceUuid is required' });
      return;
    }

    const doc = await EvotorDeviceModel.findOneAndUpdate(
      { deviceUuid },
      {
        organizationId: new Types.ObjectId(organizationId),
        registerId: typeof registerId === 'string' && registerId ? registerId : undefined,
      },
      { new: true }
    );

    if (!doc) {
      res.status(404).json({ data: null, error: 'Device not found. Ensure webhook token was received.' });
      return;
    }

    res.json({ data: { id: doc._id }, error: null });
  })
);

evotorRouter.get(
  '/devices/raw',
  authMiddleware,
  requireRole(['owner', 'superAdmin']),
  asyncHandler(async (_req, res) => {
    const devices = await EvotorDeviceModel.find()
      .sort({ createdAt: -1 })
      .select('_id deviceUuid storeUuid userId inn appUuid createdAt updatedAt');

    res.json({ data: devices, error: null });
  })
);

evotorRouter.get(
  '/devices',
  authMiddleware,
  requireRole(['owner', 'superAdmin']),
  asyncHandler(async (req, res) => {
    const organizationId = req.user?.organizationId;
    if (!organizationId || !Types.ObjectId.isValid(organizationId)) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const devices = await EvotorDeviceModel.find({ organizationId: new Types.ObjectId(organizationId) });
    res.json({ data: devices, error: null });
  })
);

evotorRouter.get(
  '/status',
  authMiddleware,
  requireRole(['owner', 'superAdmin']),
  asyncHandler(async (req, res) => {
    const organizationId = req.user?.organizationId;
    if (!organizationId || !Types.ObjectId.isValid(organizationId)) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const devices = await EvotorDeviceModel.find({ organizationId: new Types.ObjectId(organizationId) })
      .sort({ updatedAt: -1 })
      .select('deviceUuid storeUuid userId inn appUuid registerId createdAt updatedAt');

    res.json({
      data: {
        appUuid: appConfig.evotorAppUuid,
        devices,
        deviceCount: devices.length,
      },
      error: null,
    });
  })
);

export default evotorRouter;
