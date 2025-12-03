import { Router, type Request, type Response } from 'express';
import mongoose from 'mongoose';

import {
  OrganizationModel,
  type FiscalProviderSettings,
  type OrganizationSettings,
} from '../models/Organization';
import { SubscriptionPlanModel } from '../models/SubscriptionPlan';
import { UserModel, type UserRole } from '../models/User';
import { CategoryModel } from '../modules/catalog/catalog.model';
import { RestaurantSettingsModel } from '../modules/restaurant/restaurantSettings.model';
import { generateTokens, hashPassword } from '../services/authService';
import { authMiddleware, requireRole } from '../middleware/auth';
import { getFiscalProviderFromSettings, sendAtolTestReceipt } from '../services/fiscal/atol.service';

export const organizationsRouter = Router();

const DEFAULT_CATEGORIES = ['Горячие напитки', 'Холодные напитки', 'Десерты'];
const ALLOWED_ROLES: UserRole[] = ['cashier', 'owner', 'superAdmin'];

const normalizeString = (value: unknown, fieldName: string): string => {
  if (typeof value !== 'string') {
    throw new HttpError(400, `${fieldName} is required`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new HttpError(400, `${fieldName} is required`);
  }

  return trimmed;
};

const validateFiscalProviderSettings = (payload: unknown): FiscalProviderSettings | null => {
  if (payload === null) {
    return null;
  }

  if (typeof payload !== 'object' || Array.isArray(payload)) {
    throw new HttpError(400, 'fiscalProvider must be an object');
  }

  const normalizedProvider = (payload as { provider?: unknown }).provider ?? 'atol';
  if (normalizedProvider !== 'atol') {
    throw new HttpError(400, 'Only ATOL fiscal provider is supported');
  }

  const enabled = Boolean((payload as { enabled?: unknown }).enabled);
  const mode = (payload as { mode?: unknown }).mode === 'prod' ? 'prod' : 'test';
  const login = normalizeString((payload as { login?: unknown }).login, 'login');
  const password = normalizeString((payload as { password?: unknown }).password, 'password');
  const groupCode = normalizeString((payload as { groupCode?: unknown }).groupCode, 'groupCode');
  const inn = normalizeString((payload as { inn?: unknown }).inn, 'inn');
  const paymentAddress = normalizeString(
    (payload as { paymentAddress?: unknown }).paymentAddress,
    'paymentAddress'
  );
  const deviceIdRaw = (payload as { deviceId?: unknown }).deviceId;
  const deviceId = typeof deviceIdRaw === 'string' && deviceIdRaw.trim() ? deviceIdRaw.trim() : undefined;

  return {
    enabled,
    provider: 'atol',
    mode,
    login,
    password,
    groupCode,
    inn,
    paymentAddress,
    deviceId,
  };
};

organizationsRouter.get('/', authMiddleware, requireRole('superAdmin'), async (_req: Request, res: Response) => {
  try {
    const organizations = await OrganizationModel.find()
      .select('name subscriptionPlan subscriptionStatus ownerUserId createdAt settings')
      .sort({ createdAt: -1 })
      .lean();

    const ownerIds = organizations
      .map((org) => org.ownerUserId)
      .filter((id): id is mongoose.Types.ObjectId => Boolean(id));

    const ownersById = await UserModel.find({ _id: { $in: ownerIds } })
      .select('name email role')
      .lean()
      .then((owners) =>
        owners.reduce<Record<string, { name: string; email: string; role: string }>>((acc, owner) => {
          acc[String(owner._id)] = { name: owner.name, email: owner.email, role: owner.role };
          return acc;
        }, {})
      );

    const payload = organizations.map((org) => ({
      id: String(org._id),
      name: org.name,
      subscriptionPlan: org.subscriptionPlan ?? null,
      subscriptionStatus: org.subscriptionStatus,
      createdAt: org.createdAt,
      settings: org.settings ?? {},
      owner: org.ownerUserId ? ownersById[String(org.ownerUserId)] ?? null : null,
    }));

    res.json({ data: payload, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load organizations';
    res.status(500).json({ data: null, error: message });
  }
});

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type CreateOrganizationOptions = {
  allowCustomPlan?: boolean;
  allowCustomSettings?: boolean;
};

const createOrganizationWithOwner = async (
  body: any,
  { allowCustomPlan = false, allowCustomSettings = false }: CreateOrganizationOptions
) => {
  const { name, owner, subscriptionPlan, settings } = body ?? {};

  if (!name || !owner?.name || !owner?.email || !owner?.password) {
    throw new HttpError(400, 'name and owner credentials are required');
  }

  const normalizedPlan =
    allowCustomPlan && typeof subscriptionPlan === 'string' && subscriptionPlan.trim()
      ? subscriptionPlan.trim()
      : undefined;

  const normalizedName = name.trim();
  const normalizedEmail = owner.email.toLowerCase();

  const existingOrganization = await OrganizationModel.findOne({ name: normalizedName }).lean();
  if (existingOrganization) {
    throw new HttpError(409, 'Organization already exists');
  }

  const existingOwner = await UserModel.findOne({ email: normalizedEmail }).lean();
  if (existingOwner) {
    throw new HttpError(409, 'Owner with this email already exists');
  }

  const createdResources: { organizationId?: mongoose.Types.ObjectId; userId?: mongoose.Types.ObjectId } = {};

  try {
    const organization = await OrganizationModel.create({
      name: normalizedName,
      subscriptionPlan: normalizedPlan,
      subscriptionStatus: 'trial',
      settings: allowCustomSettings && settings && typeof settings === 'object' ? settings : {},
    });

    createdResources.organizationId = organization._id as mongoose.Types.ObjectId;

    const passwordHash = await hashPassword(owner.password);
    const user = await UserModel.create({
      name: owner.name,
      email: normalizedEmail,
      passwordHash,
      role: 'owner',
      organizationId: organization._id,
    });

    createdResources.userId = user._id as mongoose.Types.ObjectId;

    organization.ownerUserId = user._id as mongoose.Types.ObjectId;
    await organization.save();

    if (Array.isArray(DEFAULT_CATEGORIES) && DEFAULT_CATEGORIES.length > 0) {
      const docs = DEFAULT_CATEGORIES.map((categoryName, index) => ({
        name: categoryName,
        sortOrder: index + 1,
        organizationId: organization._id,
      }));
      await CategoryModel.insertMany(docs);
    }

    await RestaurantSettingsModel.findOneAndUpdate(
      { organizationId: organization._id },
      {
        $set: {
          organizationId: organization._id,
          singletonKey: String(organization._id),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (normalizedPlan) {
      await SubscriptionPlanModel.findOneAndUpdate(
        { name: normalizedPlan },
        { $setOnInsert: { name: normalizedPlan } },
        { upsert: true, new: true }
      );
    }

    const tokens = generateTokens(user);

    return {
      organization: {
        id: String(organization._id),
        name: organization.name,
        subscriptionPlan: organization.subscriptionPlan,
        subscriptionStatus: organization.subscriptionStatus,
      },
      owner: {
        id: String(user._id),
        name: user.name,
        email: user.email,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      dashboardUrl: `/admin?organizationId=${organization._id}`,
    };
  } catch (error) {
    if (createdResources.organizationId) {
      await OrganizationModel.deleteOne({ _id: createdResources.organizationId });
    }

    if (createdResources.userId) {
      await UserModel.deleteOne({ _id: createdResources.userId });
    }

    if (createdResources.organizationId) {
      await CategoryModel.deleteMany({ organizationId: createdResources.organizationId });
      await RestaurantSettingsModel.deleteMany({ organizationId: createdResources.organizationId });
    }

    throw error;
  }
};

const buildCreateErrorResponse = (error: unknown) => {
  const isDuplicateKey = typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 11000;
  const message = error instanceof Error ? error.message : 'Unable to create organization';
  const status =
    error instanceof HttpError
      ? error.status
      : isDuplicateKey || message.toLowerCase().includes('duplicate')
        ? 409
        : message.toLowerCase().includes('required')
          ? 400
          : 500;

  const displayMessage = isDuplicateKey ? 'Organization or owner already exists' : message;
  return { status, displayMessage };
};

organizationsRouter.post('/create', authMiddleware, requireRole('superAdmin'), async (req: Request, res: Response) => {
  try {
    const data = await createOrganizationWithOwner(req.body, { allowCustomPlan: true, allowCustomSettings: true });
    res.status(201).json({ data, error: null });
  } catch (error: unknown) {
    const { status, displayMessage } = buildCreateErrorResponse(error);
    res.status(status).json({ data: null, error: displayMessage });
  }
});

organizationsRouter.post('/public/create', async (req: Request, res: Response) => {
  try {
    const data = await createOrganizationWithOwner(req.body, { allowCustomPlan: false, allowCustomSettings: false });
    res.status(201).json({ data, error: null });
  } catch (error: unknown) {
    const { status, displayMessage } = buildCreateErrorResponse(error);
    res.status(status).json({ data: null, error: displayMessage });
  }
});

organizationsRouter.patch(
  '/:organizationId',
  authMiddleware,
  requireRole('superAdmin'),
  async (req: Request, res: Response) => {
    try {
      const { organizationId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(organizationId)) {
        res.status(400).json({ data: null, error: 'Invalid organization id' });
        return;
      }

      const updates: Record<string, unknown> = {};
      const setOperations: Record<string, unknown> = {};
      const unsetOperations: Record<string, unknown> = {};

      if (typeof req.body?.name === 'string' && req.body.name.trim()) {
        updates.name = req.body.name.trim();
      }

      if (typeof req.body?.subscriptionPlan === 'string') {
        updates.subscriptionPlan = req.body.subscriptionPlan.trim() || undefined;
      }

      if (
        typeof req.body?.subscriptionStatus === 'string' &&
        ['active', 'expired', 'trial', 'paused'].includes(req.body.subscriptionStatus)
      ) {
        updates.subscriptionStatus = req.body.subscriptionStatus;
      }

      if ('fiscalProvider' in (req.body?.settings ?? req.body)) {
        try {
          const fiscal = validateFiscalProviderSettings((req.body?.settings ?? req.body).fiscalProvider);

          if (fiscal === null) {
            unsetOperations['settings.fiscalProvider'] = '';
          } else {
            setOperations['settings.fiscalProvider'] = fiscal;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid fiscalProvider settings';
          res.status(400).json({ data: null, error: message });
          return;
        }
      }

      if (
        Object.keys(updates).length === 0 &&
        Object.keys(setOperations).length === 0 &&
        Object.keys(unsetOperations).length === 0
      ) {
        res.status(400).json({ data: null, error: 'No valid fields to update' });
        return;
      }

      const updateQuery: Record<string, unknown> = {};

      if (Object.keys(updates).length > 0 || Object.keys(setOperations).length > 0) {
        updateQuery.$set = { ...updates, ...setOperations };
      }

      if (Object.keys(unsetOperations).length > 0) {
        updateQuery.$unset = unsetOperations;
      }

      const organization = await OrganizationModel.findByIdAndUpdate(organizationId, updateQuery, { new: true });

      if (!organization) {
        res.status(404).json({ data: null, error: 'Organization not found' });
        return;
      }

      if (updates.subscriptionPlan) {
        await SubscriptionPlanModel.findOneAndUpdate(
          { name: updates.subscriptionPlan },
          { $setOnInsert: { name: updates.subscriptionPlan } },
          { upsert: true }
        );
      }

      res.json({
        data: {
          id: String(organization._id),
          name: organization.name,
          subscriptionPlan: organization.subscriptionPlan ?? null,
          subscriptionStatus: organization.subscriptionStatus,
          createdAt: organization.createdAt,
          settings: organization.settings ?? {},
        },
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update organization';
      res.status(500).json({ data: null, error: message });
    }
  }
);

organizationsRouter.post(
  '/:organizationId/fiscal/test',
  authMiddleware,
  requireRole('superAdmin'),
  async (req: Request, res: Response) => {
    const { organizationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
      res.status(400).json({ data: null, error: 'Invalid organization id' });
      return;
    }

    const organization = await OrganizationModel.findById(organizationId).lean();

    if (!organization) {
      res.status(404).json({ data: null, error: 'Organization not found' });
      return;
    }

    const fiscalProvider = getFiscalProviderFromSettings(organization.settings as OrganizationSettings | undefined);

    if (!fiscalProvider || fiscalProvider.provider !== 'atol') {
      res.status(400).json({ data: null, error: 'Fiscal provider is not configured for ATOL' });
      return;
    }

    try {
      const result = await sendAtolTestReceipt(fiscalProvider.mode, {
        login: fiscalProvider.login,
        password: fiscalProvider.password,
        groupCode: fiscalProvider.groupCode,
        inn: fiscalProvider.inn,
        paymentAddress: fiscalProvider.paymentAddress,
        deviceId: fiscalProvider.deviceId,
      });

      const lastTest = {
        status: result.status,
        testedAt: new Date(),
        receiptId: result.receiptId,
      } as FiscalProviderSettings['lastTest'];

      await OrganizationModel.findByIdAndUpdate(organizationId, {
        $set: { 'settings.fiscalProvider.lastTest': lastTest },
      });

      res.json({ data: lastTest, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send test receipt';

      const lastTest = {
        status: 'failed' as const,
        testedAt: new Date(),
        message,
      };

      await OrganizationModel.findByIdAndUpdate(organizationId, {
        $set: { 'settings.fiscalProvider.lastTest': lastTest },
      });

      res.status(502).json({ data: null, error: message });
    }
  }
);

organizationsRouter.delete(
  '/:organizationId',
  authMiddleware,
  requireRole('superAdmin'),
  async (req: Request, res: Response) => {
    try {
      const { organizationId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(organizationId)) {
        res.status(400).json({ data: null, error: 'Invalid organization id' });
        return;
      }

      const result = await OrganizationModel.findByIdAndDelete(organizationId);

      if (!result) {
        res.status(404).json({ data: null, error: 'Organization not found' });
        return;
      }

      res.json({ data: { id: organizationId }, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete organization';
      res.status(500).json({ data: null, error: message });
    }
  }
);

organizationsRouter.get(
  '/users',
  authMiddleware,
  requireRole('superAdmin'),
  async (_req: Request, res: Response) => {
    try {
      const users = await UserModel.aggregate([
        { $sort: { createdAt: -1 } },
        {
          $lookup: {
            from: 'organizations',
            localField: 'organizationId',
            foreignField: '_id',
            as: 'organization',
          },
        },
        { $unwind: { path: '$organization', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            name: 1,
            email: 1,
            role: 1,
            createdAt: 1,
            organization: {
              id: '$organization._id',
              name: '$organization.name',
            },
          },
        },
      ]);

      const payload = users.map((user) => ({
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        organization: user.organization?.id
          ? { id: String(user.organization.id), name: user.organization.name ?? '—' }
          : null,
      }));

      res.json({ data: payload, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load users';
      res.status(500).json({ data: null, error: message });
    }
  }
);

organizationsRouter.patch(
  '/users/:userId',
  authMiddleware,
  requireRole('superAdmin'),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ data: null, error: 'Invalid user id' });
        return;
      }

      const { name, email, role, organizationId } = req.body ?? {};
      const updates: Record<string, unknown> = {};

      if (typeof name === 'string' && name.trim()) {
        updates.name = name.trim();
      }

      if (typeof email === 'string' && email.trim()) {
        updates.email = email.trim().toLowerCase();
      }

      if (typeof role === 'string' && ALLOWED_ROLES.includes(role as UserRole)) {
        updates.role = role;
      }

      if (organizationId === null || organizationId === '') {
        updates.organizationId = undefined;
      } else if (typeof organizationId === 'string') {
        if (!mongoose.Types.ObjectId.isValid(organizationId)) {
          res.status(400).json({ data: null, error: 'Invalid organization id' });
          return;
        }

        const organization = await OrganizationModel.findById(organizationId);
        if (!organization) {
          res.status(404).json({ data: null, error: 'Organization not found' });
          return;
        }

        updates.organizationId = organization._id;
      }

      if (Object.keys(updates).length === 0) {
        res.status(400).json({ data: null, error: 'No valid fields to update' });
        return;
      }

      const user = await UserModel.findById(userId);

      if (!user) {
        res.status(404).json({ data: null, error: 'User not found' });
        return;
      }

      Object.assign(user, updates);
      await user.save();

      const organization =
        user.organizationId && mongoose.Types.ObjectId.isValid(user.organizationId)
          ? await OrganizationModel.findById(user.organizationId).select('name').lean()
          : null;

      res.json({
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
          organization: organization ? { id: String(organization._id), name: organization.name } : null,
        },
        error: null,
      });
    } catch (error) {
      const isDuplicateKey = typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 11000;
      const message = error instanceof Error ? error.message : 'Unable to update user';
      const status = isDuplicateKey
        ? 409
        : message.toLowerCase().includes('invalid')
          ? 400
          : message.toLowerCase().includes('not found')
            ? 404
            : 500;

      res.status(status).json({ data: null, error: isDuplicateKey ? 'User with this email already exists' : message });
    }
  }
);

organizationsRouter.delete(
  '/users/:userId',
  authMiddleware,
  requireRole('superAdmin'),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ data: null, error: 'Invalid user id' });
        return;
      }

      const deleted = await UserModel.findByIdAndDelete(userId);

      if (!deleted) {
        res.status(404).json({ data: null, error: 'User not found' });
        return;
      }

      await OrganizationModel.updateMany({ ownerUserId: userId }, { $unset: { ownerUserId: '' } });

      res.json({ data: { id: userId }, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete user';
      res.status(500).json({ data: null, error: message });
    }
  }
);

export default organizationsRouter;
