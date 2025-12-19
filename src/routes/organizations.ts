import { Router, type Request, type Response } from 'express';
import mongoose from 'mongoose';

import { AppSettingsModel } from '../models/AppSettings';
import {
  OrganizationModel,
  type SubscriptionPlan,
  type OrganizationDocument,
} from '../models/Organization';
import { SubscriptionPlanModel } from '../models/SubscriptionPlan';
import { UserModel, type UserRole } from '../models/User';
import { CategoryModel, ProductModel } from '../modules/catalog/catalog.model';
import { IngredientModel } from '../modules/catalog/ingredient.model';
import { ModifierGroupModel } from '../modules/catalog/modifierGroup.model';
import { CustomerModel } from '../modules/customers/customer.model';
import { DiscountModel } from '../modules/discounts/discount.model';
import { InventoryAuditModel } from '../modules/inventory/inventoryAudit.model';
import { InventoryItemModel } from '../modules/inventory/inventoryItem.model';
import { StockReceiptModel } from '../modules/inventory/stockReceipt.model';
import { WarehouseModel } from '../modules/inventory/warehouse.model';
import { OrderModel } from '../modules/orders/order.model';
import { RestaurantSettingsModel } from '../modules/restaurant/restaurantSettings.model';
import { ShiftModel } from '../modules/shifts/shift.model';
import { SupplierModel } from '../modules/suppliers/supplier.model';
import { generateTokens, hashPassword } from '../services/authService';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  buildBillingInfo,
  DEFAULT_BILLING_CYCLE_DAYS,
  loadPlanPricing,
  simulatePaymentCycle,
  synchronizeOrganizationBilling,
  TRIAL_PERIOD_DAYS,
} from '../services/billing.service';

export const organizationsRouter = Router();

const DEFAULT_CATEGORIES = ['Горячие напитки', 'Холодные напитки', 'Десерты'];
const ALLOWED_ROLES: UserRole[] = ['cashier', 'owner', 'superAdmin'];
const ONE_DAY_MS = 1000 * 60 * 60 * 24;

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * ONE_DAY_MS);

const isSubscriptionReadOnly = (status: string | null | undefined) => ['expired', 'paused'].includes(status ?? '');

const getBillingConfig = async () => {
  const settings = await AppSettingsModel.findOne().select('billingEnabled').lean();
  if (settings) {
    return { billingEnabled: Boolean(settings.billingEnabled) };
  }

  const created = await AppSettingsModel.create({ billingEnabled: false });
  return { billingEnabled: created.billingEnabled };
};

const ensureOrganizationIsEditable = async (
  req: Request,
  res: Response,
  organizationId: string
): Promise<OrganizationDocument | null> => {
  const organization = await OrganizationModel.findById(organizationId).select('subscriptionStatus');

  if (!organization) {
    res.status(404).json({ data: null, error: 'Organization not found' });
    return null;
  }

  if (req.user?.role === 'superAdmin') {
    return organization;
  }

  if (isSubscriptionReadOnly(organization.subscriptionStatus)) {
    res
      .status(402)
      .json({ data: null, error: 'Подписка неактивна. Продлите её, чтобы продолжить редактирование данных.' });
    return null;
  }

  return organization;
};

const normalizePlanName = (rawPlan: unknown, allowCustomPlan: boolean): SubscriptionPlan => {
  if (!allowCustomPlan) {
    return 'trial';
  }

  if (typeof rawPlan !== 'string') {
    return 'trial';
  }

  const normalized = rawPlan.trim();

  if (!normalized) {
    return 'trial';
  }

  if (!['trial', 'paid'].includes(normalized)) {
    throw new HttpError(400, 'subscriptionPlan must be trial or paid');
  }

  return normalized as SubscriptionPlan;
};

const isOwnerRequestingOtherOrganization = (req: Request, organizationId: string) =>
  req.user?.role === 'owner' && String(req.user.organizationId) !== organizationId;

organizationsRouter.get('/', authMiddleware, requireRole('superAdmin'), async (_req: Request, res: Response) => {
  try {
    const organizations = await OrganizationModel.find()
      .select('name subscriptionPlan subscriptionStatus ownerUserId createdAt settings trialEndsAt nextPaymentDueAt updatedAt')
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

    const pricing = await loadPlanPricing(organizations.map((org) => org.subscriptionPlan));

    const payload = await Promise.all(
      organizations.map(async (org) => {
        const billing = await synchronizeOrganizationBilling(org as any, pricing);

        return {
          id: String(org._id),
          name: org.name,
          subscriptionPlan: org.subscriptionPlan ?? 'trial',
          subscriptionStatus: billing.status,
          createdAt: org.createdAt,
          settings: org.settings ?? {},
          owner: org.ownerUserId ? ownersById[String(org.ownerUserId)] ?? null : null,
          billing: {
            ...billing,
            trialEndsAt: billing.trialEndsAt ?? null,
            nextPaymentDueAt: billing.nextPaymentDueAt ?? null,
          },
        };
      })
    );

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

  const normalizedPlan = normalizePlanName(subscriptionPlan, allowCustomPlan);

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
    const now = new Date();
    const organization = await OrganizationModel.create({
      name: normalizedName,
      subscriptionPlan: normalizedPlan,
      subscriptionStatus: normalizedPlan === 'paid' ? 'active' : 'trial',
      trialEndsAt: normalizedPlan === 'trial' ? addDays(now, TRIAL_PERIOD_DAYS) : undefined,
      nextPaymentDueAt: normalizedPlan === 'paid' ? addDays(now, DEFAULT_BILLING_CYCLE_DAYS) : undefined,
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
          name: organization.name,
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
    const pricing = await loadPlanPricing([normalizedPlan]);
    const billing = buildBillingInfo(organization as any, pricing);

    return {
      organization: {
        id: String(organization._id),
        name: organization.name,
        subscriptionPlan: organization.subscriptionPlan,
        subscriptionStatus: billing.status,
        billing,
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

organizationsRouter.get(
  '/billing/config',
  authMiddleware,
  requireRole('superAdmin'),
  async (_req: Request, res: Response) => {
    try {
      const config = await getBillingConfig();
      res.json({ data: config, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load billing config';
      res.status(500).json({ data: null, error: message });
    }
  }
);

organizationsRouter.patch(
  '/billing/config',
  authMiddleware,
  requireRole('superAdmin'),
  async (req: Request, res: Response) => {
    try {
      const billingEnabled = Boolean(req.body?.billingEnabled);
      const updated = await AppSettingsModel.findOneAndUpdate(
        {},
        { $set: { billingEnabled } },
        { upsert: true, new: true }
      ).select('billingEnabled');

      res.json({ data: { billingEnabled: Boolean(updated?.billingEnabled) }, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update billing config';
      res.status(500).json({ data: null, error: message });
    }
  }
);

organizationsRouter.get(
  '/billing/summary',
  authMiddleware,
  requireRole('superAdmin'),
  async (_req: Request, res: Response) => {
    try {
      const organizations = await OrganizationModel.find()
        .select('subscriptionPlan subscriptionStatus createdAt updatedAt trialEndsAt nextPaymentDueAt')
        .lean();

      const pricing = await loadPlanPricing(organizations.map((org) => org.subscriptionPlan));
      const billings = await Promise.all(
        organizations.map((org) => synchronizeOrganizationBilling(org as any, pricing))
      );

      const summary = billings.reduce(
        (acc, billing) => {
          if (billing.plan === 'trial') {
            acc.activeTrials += billing.status === 'trial' ? 1 : 0;
            acc.expiredTrials += billing.status === 'expired' ? 1 : 0;
          }

          if (billing.plan === 'paid') {
            if (billing.status === 'active') {
              acc.activePaid += 1;
              acc.projectedMrr += billing.monthlyPrice;
            }

            if (billing.status === 'paused') {
              acc.pausedPaid += 1;
            }

            if (billing.isPaymentDue) {
              acc.overduePayments += 1;
            }

            acc.expectedNext30DaysRevenue += billing.monthlyPrice;
          }

          return acc;
        },
        {
          totalOrganizations: organizations.length,
          activeTrials: 0,
          expiredTrials: 0,
          activePaid: 0,
          pausedPaid: 0,
          overduePayments: 0,
          projectedMrr: 0,
          expectedNext30DaysRevenue: 0,
        }
      );

      res.json({ data: summary, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load billing summary';
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

organizationsRouter.get(
  '/:organizationId',
  authMiddleware,
  requireRole(['owner', 'superAdmin']),
  async (req: Request, res: Response) => {
    const { organizationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
      res.status(400).json({ data: null, error: 'Invalid organization id' });
      return;
    }

    if (isOwnerRequestingOtherOrganization(req, organizationId)) {
      res.status(403).json({ data: null, error: 'Forbidden' });
      return;
    }

    const organization = await OrganizationModel.findById(organizationId)
      .select('name subscriptionPlan subscriptionStatus createdAt settings trialEndsAt nextPaymentDueAt updatedAt')
      .lean();

    if (!organization) {
      res.status(404).json({ data: null, error: 'Organization not found' });
      return;
    }

    const [pricing, billingConfig] = await Promise.all([
      loadPlanPricing([organization.subscriptionPlan]),
      getBillingConfig(),
    ]);
    const billing = await synchronizeOrganizationBilling(organization as any, pricing);

    res.json({
      data: {
        id: String(organization._id),
        name: organization.name,
        subscriptionPlan: organization.subscriptionPlan ?? 'trial',
        subscriptionStatus: billing.status,
        createdAt: organization.createdAt,
        settings: organization.settings ?? {},
        billingEnabled: billingConfig.billingEnabled,
        billing: {
          ...billing,
          trialEndsAt: billing.trialEndsAt ?? null,
          nextPaymentDueAt: billing.nextPaymentDueAt ?? null,
        },
      },
      error: null,
    });
  }
);

organizationsRouter.patch(
  '/:organizationId',
  authMiddleware,
  requireRole(['owner', 'superAdmin']),
  async (req: Request, res: Response) => {
    try {
      const { organizationId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(organizationId)) {
        res.status(400).json({ data: null, error: 'Invalid organization id' });
        return;
      }

    if (isOwnerRequestingOtherOrganization(req, organizationId)) {
      res.status(403).json({ data: null, error: 'Forbidden' });
      return;
    }

    const editableOrganization = await ensureOrganizationIsEditable(req, res, organizationId);
    if (!editableOrganization) {
      return;
    }

    const updates: Record<string, unknown> = {};
    const setOperations: Record<string, unknown> = {};
    const unsetOperations: Record<string, unknown> = {};

      const parseDateField = (value: unknown, field: 'trialEndsAt' | 'nextPaymentDueAt') => {
        if (value === undefined) {
          return true;
        }

        if (value === null || value === '') {
          unsetOperations[field] = '';
          return true;
        }

        if (value instanceof Date || typeof value === 'string' || typeof value === 'number') {
          const date = new Date(value);
          if (Number.isNaN(date.getTime())) {
            res.status(400).json({ data: null, error: `${field} must be a valid date` });
            return false;
          }

          setOperations[field] = date;
          return true;
        }

        res.status(400).json({ data: null, error: `${field} must be a date string` });
        return false;
      };

      if (req.user?.role === 'superAdmin') {
        if (typeof req.body?.name === 'string' && req.body.name.trim()) {
          updates.name = req.body.name.trim();
        }

        if (typeof req.body?.subscriptionPlan === 'string') {
          const normalizedPlan = normalizePlanName(req.body.subscriptionPlan, true);
          updates.subscriptionPlan = normalizedPlan;

          if (normalizedPlan === 'trial') {
            setOperations.trialEndsAt = addDays(new Date(), TRIAL_PERIOD_DAYS);
            unsetOperations.nextPaymentDueAt = '';
            updates.subscriptionStatus = 'trial';
          }

          if (normalizedPlan === 'paid') {
            setOperations.nextPaymentDueAt = simulatePaymentCycle();
            updates.subscriptionStatus = updates.subscriptionStatus ?? 'active';
          }
        }

        if (
          typeof req.body?.subscriptionStatus === 'string' &&
          ['active', 'expired', 'trial', 'paused'].includes(req.body.subscriptionStatus)
        ) {
          updates.subscriptionStatus = req.body.subscriptionStatus;
        }

        const parsedTrial = parseDateField(req.body?.trialEndsAt, 'trialEndsAt');
        if (!parsedTrial) return;

        const parsedNextPayment = parseDateField(req.body?.nextPaymentDueAt, 'nextPaymentDueAt');
        if (!parsedNextPayment) return;
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

      const pricing = await loadPlanPricing([organization.subscriptionPlan]);
      const billing = await synchronizeOrganizationBilling(organization as any, pricing);

      res.json({
        data: {
          id: String(organization._id),
          name: organization.name,
          subscriptionPlan: organization.subscriptionPlan ?? null,
          subscriptionStatus: billing.status,
          createdAt: organization.createdAt,
          settings: organization.settings ?? {},
          billing: {
            ...billing,
            trialEndsAt: billing.trialEndsAt ?? null,
            nextPaymentDueAt: billing.nextPaymentDueAt ?? null,
          },
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
  '/:organizationId/billing/simulate-payment',
  authMiddleware,
  requireRole(['owner', 'superAdmin']),
  async (req: Request, res: Response) => {
    const { organizationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
      res.status(400).json({ data: null, error: 'Invalid organization id' });
      return;
    }

    if (isOwnerRequestingOtherOrganization(req, organizationId)) {
      res.status(403).json({ data: null, error: 'Forbidden' });
      return;
    }

    const organization = await OrganizationModel.findById(organizationId);

    if (!organization) {
      res.status(404).json({ data: null, error: 'Organization not found' });
      return;
    }

    organization.subscriptionPlan = 'paid';
    organization.subscriptionStatus = 'active';
    organization.nextPaymentDueAt = simulatePaymentCycle(organization.nextPaymentDueAt ?? new Date());

    await organization.save();

    const pricing = await loadPlanPricing([organization.subscriptionPlan]);
    const billing = buildBillingInfo(organization as any, pricing);

    res.json({
      data: {
        id: String(organization._id),
        subscriptionPlan: organization.subscriptionPlan,
        subscriptionStatus: billing.status,
        billing: {
          ...billing,
          trialEndsAt: billing.trialEndsAt ?? null,
          nextPaymentDueAt: billing.nextPaymentDueAt ?? null,
        },
      },
      error: null,
    });
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

      const organizationObjectId = new mongoose.Types.ObjectId(organizationId);
      const organization = await OrganizationModel.findById(organizationObjectId);

      if (!organization) {
        res.status(404).json({ data: null, error: 'Organization not found' });
        return;
      }

      await Promise.all([
        CategoryModel.deleteMany({ organizationId: organizationObjectId }),
        ProductModel.deleteMany({ organizationId: organizationObjectId }),
        IngredientModel.deleteMany({ organizationId: organizationObjectId }),
        ModifierGroupModel.deleteMany({ organizationId: organizationObjectId }),
        CustomerModel.deleteMany({ organizationId: organizationObjectId }),
        DiscountModel.deleteMany({ organizationId: organizationObjectId }),
        OrderModel.deleteMany({ organizationId: organizationObjectId }),
        ShiftModel.deleteMany({ organizationId: organizationObjectId }),
        SupplierModel.deleteMany({ organizationId: organizationObjectId }),
        WarehouseModel.deleteMany({ organizationId: organizationObjectId }),
        InventoryItemModel.deleteMany({ organizationId: organizationObjectId }),
        InventoryAuditModel.deleteMany({ organizationId: organizationObjectId }),
        StockReceiptModel.deleteMany({ organizationId: organizationObjectId }),
        RestaurantSettingsModel.deleteMany({ organizationId: organizationObjectId }),
        UserModel.deleteMany({ organizationId: organizationObjectId }),
      ]);

      await OrganizationModel.deleteOne({ _id: organizationObjectId });

      res.json({ data: { id: organizationId }, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete organization';
      res.status(500).json({ data: null, error: message });
    }
  }
);


export default organizationsRouter;
