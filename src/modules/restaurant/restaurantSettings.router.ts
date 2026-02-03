import { Router, type Request, type RequestHandler, type Response } from 'express';
import { Types } from 'mongoose';

import { authMiddleware, requireRole } from '../../middleware/auth';
import { enforceActiveSubscription } from '../../middleware/subscription';
import {
  getRestaurantBranding,
  resetRestaurantBranding,
  updateRestaurantBranding,
  restaurantBrandingDefaults,
  type RestaurantBranding,
  getCashRegisterSettings,
  updateCashRegisterSettings,
  type CashRegisterSettings,
} from './restaurantSettings.service';

const router = Router();

router.use(authMiddleware);
router.use(enforceActiveSubscription);

const asyncHandler = (handler: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

const getOrganizationObjectId = (req: Request): Types.ObjectId | null => {
  const organizationId = req.organization?.id;

  if (!organizationId || !Types.ObjectId.isValid(organizationId)) {
    return null;
  }

  return new Types.ObjectId(organizationId);
};

const parseBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return undefined;
};

const parseNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

function extractBrandingUpdatePayload(body: unknown): Partial<RestaurantBranding> | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const { name, logoUrl, enableOrderTags, measurementUnits, loyaltyRate, loyaltyRedeemAllCategories, loyaltyRedeemCategoryIds } =
    body as Record<string, unknown>;

  const parsedEnableOrderTags = parseBoolean(enableOrderTags);
  const parsedLoyaltyRate = parseNumber(loyaltyRate);
  const parsedRedeemAllCategories = parseBoolean(loyaltyRedeemAllCategories);

  const normalizedUnits = Array.isArray(measurementUnits)
    ? measurementUnits
        .map((unit) => (typeof unit === 'string' ? unit : typeof unit === 'number' ? String(unit) : ''))
        .filter((unit) => unit.trim().length > 0)
    : undefined;
  const normalizedRedeemCategoryIds = Array.isArray(loyaltyRedeemCategoryIds)
    ? loyaltyRedeemCategoryIds
        .map((id) => (typeof id === 'string' ? id.trim() : ''))
        .filter((id) => Types.ObjectId.isValid(id))
    : undefined;

  const updatePayload: Partial<RestaurantBranding> = {
    name: typeof name === 'string' ? name : undefined,
    logoUrl: typeof logoUrl === 'string' ? logoUrl : undefined,
    enableOrderTags: typeof parsedEnableOrderTags === 'boolean' ? parsedEnableOrderTags : undefined,
    measurementUnits: normalizedUnits,
    loyaltyRate: typeof parsedLoyaltyRate === 'number' ? parsedLoyaltyRate : undefined,
    loyaltyRedeemAllCategories:
      typeof parsedRedeemAllCategories === 'boolean' ? parsedRedeemAllCategories : undefined,
    loyaltyRedeemCategoryIds: normalizedRedeemCategoryIds,
  };

  return Object.values(updatePayload).every((value) => value === undefined) ? null : updatePayload;
}

function extractCashRegisterUpdatePayload(body: unknown): Partial<CashRegisterSettings> | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const { provider } = body as Record<string, unknown>;
  const normalizedProvider = provider === 'atol' ? 'atol' : provider === 'none' ? 'none' : undefined;

  const updatePayload: Partial<CashRegisterSettings> = {
    provider: normalizedProvider,
  };

  return Object.values(updatePayload).every((value) => value === undefined) ? null : updatePayload;
}

router.get(
  '/branding',
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const branding = await getRestaurantBranding(organizationId);

    res.json({ data: { branding }, error: null });
  })
);

router.get(
  '/cash-register',
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const settings = await getCashRegisterSettings(organizationId);

    res.json({ data: { settings }, error: null });
  })
);

router.put(
  '/branding',
  requireRole(['owner', 'superAdmin']),
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const updatePayload = extractBrandingUpdatePayload(req.body);

    if (!updatePayload) {
      res.status(400).json({ data: null, error: 'Не переданы валидные данные брендинга' });
      return;
    }

    try {
      const branding = await updateRestaurantBranding(organizationId, updatePayload);
      res.json({ data: { branding }, error: null });
    } catch (error) {
      console.error('Failed to update restaurant branding:', error);
      res.status(400).json({ data: null, error: 'Некорректные данные брендинга' });
    }
  })
);

router.put(
  '/cash-register',
  requireRole(['owner', 'superAdmin']),
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const updatePayload = extractCashRegisterUpdatePayload(req.body);

    if (!updatePayload) {
      res.status(400).json({ data: null, error: 'Не переданы валидные данные кассы' });
      return;
    }

    try {
      const settings = await updateCashRegisterSettings(organizationId, updatePayload);
      res.json({ data: { settings }, error: null });
    } catch (error) {
      console.error('Failed to update cash register settings:', error);
      res.status(400).json({ data: null, error: 'Некорректные данные кассы' });
    }
  })
);

router.patch('/branding', requireRole(['owner', 'superAdmin']), asyncHandler(updateRestaurantBrandingHandler));

async function updateRestaurantBrandingHandler(req: Request, res: Response): Promise<void> {
  const { name, logoUrl, enableOrderTags, measurementUnits, loyaltyRate, loyaltyRedeemAllCategories, loyaltyRedeemCategoryIds, reset } =
    req.body ?? {};
  const organizationId = getOrganizationObjectId(req);

  if (!organizationId) {
    res.status(403).json({ data: null, error: 'Organization context is required' });
    return;
  }

  if (reset === true) {
    const branding = await resetRestaurantBranding(organizationId);
    res.json({ data: { branding }, error: null });
    return;
  }

  const updatePayload = extractBrandingUpdatePayload({
    name,
    logoUrl,
    enableOrderTags,
    measurementUnits,
    loyaltyRate,
    loyaltyRedeemAllCategories,
    loyaltyRedeemCategoryIds,
  });

  if (!updatePayload) {
    res.status(400).json({ data: null, error: 'Не переданы валидные данные брендинга' });
    return;
  }

  try {
    const branding = await updateRestaurantBranding(organizationId, updatePayload);
    res.json({ data: { branding }, error: null });
  } catch (error) {
    console.error('Failed to update restaurant branding:', error);
    res.status(400).json({ data: null, error: 'Некорректные данные брендинга' });
  }
}

router.post(
  '/branding/reset',
  requireRole(['owner', 'superAdmin']),
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const branding = await resetRestaurantBranding(organizationId);
    res.json({ data: { branding }, error: null });
  })
);

router.get(
  '/branding/defaults',
  requireRole(['owner', 'superAdmin']),
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ data: { branding: restaurantBrandingDefaults }, error: null });
  })
);
export default router;
