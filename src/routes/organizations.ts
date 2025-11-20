import { Router, type Request, type Response } from 'express';
import mongoose from 'mongoose';

import { OrganizationModel } from '../models/Organization';
import { SubscriptionPlanModel } from '../models/SubscriptionPlan';
import { UserModel } from '../models/User';
import { CategoryModel } from '../modules/catalog/catalog.model';
import { RestaurantSettingsModel } from '../modules/restaurant/restaurantSettings.model';
import { generateTokens, hashPassword } from '../services/authService';

export const organizationsRouter = Router();

const DEFAULT_CATEGORIES = ['Горячие напитки', 'Холодные напитки', 'Десерты'];

organizationsRouter.post('/create', async (req: Request, res: Response) => {
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

      organization.ownerUserId = user._id;
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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create organization';
    const status = message.toLowerCase().includes('required') ? 400 : 500;
    res.status(status).json({ data: null, error: message });
  }
});

export default organizationsRouter;
