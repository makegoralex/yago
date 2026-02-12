import { Router } from 'express';
import { Types } from 'mongoose';

import { authMiddleware, requireRole } from '../../middleware/auth';
import { EvotorDeviceModel } from './evotor.model';
import { appConfig } from '../../config/env';
import { authenticateUser } from '../../services/authService';
const asyncHandler =
  (fn: (req: any, res: any) => Promise<void>) =>
  (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res)).catch(next);

const evotorRouter = Router();

const maskSecret = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length <= 8) {
    return '***';
  }

  return `${trimmed.slice(0, 4)}***${trimmed.slice(-4)}`;
};

const logEvotorTokenWebhook = (req: any): void => {
  if (!appConfig.evotorWebhookDebug) {
    return;
  }

  const payload = req.body ?? {};
  const payloadToken = typeof payload.token === 'string' ? payload.token : undefined;

  console.info('[evotor][token] webhook payload received', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    authorization: maskSecret(
      typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined
    ),
    payload: {
      ...payload,
      token: maskSecret(payloadToken),
    },
  });
};

const pickString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return undefined;
};

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
  '/user/verify',
  asyncHandler(async (req, res) => {
    if (!ensureWebhookAuth(req.headers.authorization)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const payload = req.body ?? {};
    const evotorUserId = pickString(payload.userId, payload.user_id, payload.userUuid, payload.user_uuid);
    const username = pickString(payload.username, payload.login, payload.email);
    const password = pickString(payload.password);
    const organizationId = pickString(payload.organizationId, payload.organization_id, payload.customField);

    if (!evotorUserId || !username || !password) {
      res.status(400).json({ error: 'userId, username and password are required' });
      return;
    }

    try {
      const { tokens } = await authenticateUser(username, password, organizationId);

      res.json({
        userId: evotorUserId,
        token: tokens.accessToken,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid credentials';
      res.status(401).json({ error: message });
    }
  })
);

evotorRouter.post(
  '/token',
  asyncHandler(async (req, res) => {
    logEvotorTokenWebhook(req);

    if (!ensureWebhookAuth(req.headers.authorization)) {
      if (appConfig.evotorWebhookDebug) {
        console.warn('[evotor][token] unauthorized webhook request', {
          authorization: maskSecret(
            typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined
          ),
        });
      }

      res.status(401).json({ data: null, error: 'Unauthorized' });
      return;
    }

    const payload = req.body ?? {};
    const user = payload.user ?? {};
    const token = pickString(payload.token) ?? '';

    if (!token) {
      if (appConfig.evotorWebhookDebug) {
        console.warn('[evotor][token] request rejected: token is required in payload');
      }

      res.status(400).json({ data: null, error: 'Token is required' });
      return;
    }

    const userId = pickString(user.id, user.userId, user.user_uuid, user.userUuid, payload.userId, payload.user_id, payload.userUuid, payload.user_uuid);
    if (!userId) {
      if (appConfig.evotorWebhookDebug) {
        console.warn('[evotor][token] request rejected: user id is required in payload', {
          payloadKeys: Object.keys(payload),
        });
      }

      res.status(400).json({ data: null, error: 'User identifier is required' });
      return;
    }

    const inn = pickString(user.inn, payload.inn);
    const deviceUuid = pickString(payload.device_uuid, payload.deviceUuid);
    const storeUuid = pickString(payload.store_uuid, payload.storeUuid);

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

    if (appConfig.evotorWebhookDebug) {
      console.info('[evotor][token] webhook saved', {
        id: doc._id,
        userId,
        deviceUuid,
        storeUuid,
      });
    }

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
