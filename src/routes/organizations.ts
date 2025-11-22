import { Router, type Request, type Response } from 'express';
import mongoose from 'mongoose';

import { OrganizationModel } from '../models/Organization';
import { SubscriptionPlanModel } from '../models/SubscriptionPlan';
import { UserModel } from '../models/User';
import { CategoryModel } from '../modules/catalog/catalog.model';
import { RestaurantSettingsModel } from '../modules/restaurant/restaurantSettings.model';
import { generateTokens, hashPassword } from '../services/authService';
import { requireAuth, requireRole } from '../middleware/auth';

export const organizationsRouter = Router();

const DEFAULT_CATEGORIES = ['Горячие напитки', 'Холодные напитки', 'Десерты'];

organizationsRouter.get('/', requireAuth, requireRole('superAdmin'), async (_req: Request, res: Response) => {
  try {
    const organizations = await OrganizationModel.find()
      .select('name subscriptionPlan subscriptionStatus ownerUserId createdAt')
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
      owner: org.ownerUserId ? ownersById[String(org.ownerUserId)] ?? null : null,
    }));

    res.json({ data: payload, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load organizations';
    res.status(500).json({ data: null, error: message });
  }
});

organizationsRouter.post('/create', requireAuth, requireRole('superAdmin'), async (req: Request, res: Response) => {
  try {
    const { name, owner, subscriptionPlan, settings } = req.body ?? {};

    if (!name || !owner?.name || !owner?.email || !owner?.password) {
      res.status(400).json({ data: null, error: 'name and owner credentials are required' });
      return;
    }

    const normalizedPlan =
      typeof subscriptionPlan === 'string' && subscriptionPlan.trim() ? subscriptionPlan.trim() : undefined;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const organization = await OrganizationModel.create(
        [
          {
            name: name.trim(),
            subscriptionPlan: normalizedPlan,
            subscriptionStatus: 'trial',
            settings: settings && typeof settings === 'object' ? settings : {},
          },
        ],
        { session }
      ).then((created) => created[0]);

      const passwordHash = await hashPassword(owner.password);
      const user = await UserModel.create(
        [
          {
            name: owner.name,
            email: owner.email.toLowerCase(),
            passwordHash,
            role: 'owner',
            organizationId: organization._id,
          },
        ],
        { session }
      ).then((created) => created[0]);

      organization.ownerUserId = user._id as mongoose.Types.ObjectId;
      await organization.save({ session });

      if (Array.isArray(DEFAULT_CATEGORIES) && DEFAULT_CATEGORIES.length > 0) {
        const docs = DEFAULT_CATEGORIES.map((categoryName, index) => ({
          name: categoryName,
          sortOrder: index + 1,
          organizationId: organization._id,
        }));
        await CategoryModel.insertMany(docs, { session });
      }

      await RestaurantSettingsModel.create(
        [
          {
            organizationId: organization._id,
            singletonKey: String(organization._id),
            currency: 'RUB',
            locale: 'ru-RU',
          },
        ],
        { session }
      );

      if (normalizedPlan) {
        await SubscriptionPlanModel.findOneAndUpdate(
          { name: normalizedPlan },
          { $setOnInsert: { name: normalizedPlan } },
          { upsert: true, new: true, session }
        );
      }

      await session.commitTransaction();
      session.endSession();

      const tokens = generateTokens(user);

      res.status(201).json({
        data: {
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
        },
        error: null,
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error: unknown) {
    const isDuplicateKey = typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 11000;
    const message = error instanceof Error ? error.message : 'Unable to create organization';
    const status = isDuplicateKey || message.toLowerCase().includes('duplicate') ? 409 : message.toLowerCase().includes('required') ? 400 : 500;

    res.status(status).json({ data: null, error: isDuplicateKey ? 'Organization or owner already exists' : message });
  }
});

organizationsRouter.patch(
  '/:organizationId',
  requireAuth,
  requireRole('superAdmin'),
  async (req: Request, res: Response) => {
    try {
      const { organizationId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(organizationId)) {
        res.status(400).json({ data: null, error: 'Invalid organization id' });
        return;
      }

      const updates: Record<string, unknown> = {};

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

      if (Object.keys(updates).length === 0) {
        res.status(400).json({ data: null, error: 'No valid fields to update' });
        return;
      }

      const organization = await OrganizationModel.findByIdAndUpdate(
        organizationId,
        { $set: updates },
        { new: true }
      );

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
        },
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update organization';
      res.status(500).json({ data: null, error: message });
    }
  }
);

organizationsRouter.delete(
  '/:organizationId',
  requireAuth,
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

export default organizationsRouter;
