import { Router, type Request, type RequestHandler, type Response } from 'express';

import { authMiddleware, requireRole } from '../../middleware/auth';
import {
  getRestaurantBranding,
  resetRestaurantBranding,
  updateRestaurantBranding,
  restaurantBrandingDefaults,
  type RestaurantBranding,
} from './restaurantSettings.service';

const router = Router();

router.use(authMiddleware);

const asyncHandler = (handler: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
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

  const { name, logoUrl, enableOrderTags, measurementUnits, loyaltyRate } = body as Record<string, unknown>;

  const parsedEnableOrderTags = parseBoolean(enableOrderTags);
  const parsedLoyaltyRate = parseNumber(loyaltyRate);

  const normalizedUnits = Array.isArray(measurementUnits)
    ? measurementUnits
        .map((unit) => (typeof unit === 'string' ? unit : typeof unit === 'number' ? String(unit) : ''))
        .filter((unit) => unit.trim().length > 0)
    : undefined;

  const updatePayload: Partial<RestaurantBranding> = {
    name: typeof name === 'string' ? name : undefined,
    logoUrl: typeof logoUrl === 'string' ? logoUrl : undefined,
    enableOrderTags: typeof parsedEnableOrderTags === 'boolean' ? parsedEnableOrderTags : undefined,
    measurementUnits: normalizedUnits,
    loyaltyRate: typeof parsedLoyaltyRate === 'number' ? parsedLoyaltyRate : undefined,
  };

  return Object.values(updatePayload).every((value) => value === undefined) ? null : updatePayload;
}

router.get(
  '/branding',
  asyncHandler(async (_req: Request, res: Response) => {
    const branding = await getRestaurantBranding();

    res.json({ data: { branding }, error: null });
  })
);

router.put(
  '/branding',
  requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const updatePayload = extractBrandingUpdatePayload(req.body);

    if (!updatePayload) {
      res.status(400).json({ data: null, error: 'Не переданы валидные данные брендинга' });
      return;
    }

    try {
      const branding = await updateRestaurantBranding(updatePayload);
      res.json({ data: { branding }, error: null });
    } catch (error) {
      console.error('Failed to update restaurant branding:', error);
      res.status(400).json({ data: null, error: 'Некорректные данные брендинга' });
    }
  })
);

router.patch('/branding', requireRole('admin'), asyncHandler(updateRestaurantBrandingHandler));

async function updateRestaurantBrandingHandler(req: Request, res: Response): Promise<void> {
  const { name, logoUrl, enableOrderTags, measurementUnits, loyaltyRate, reset } = req.body ?? {};

  if (reset === true) {
    const branding = await resetRestaurantBranding();
    res.json({ data: { branding }, error: null });
    return;
  }

  const updatePayload = extractBrandingUpdatePayload({
    name,
    logoUrl,
    enableOrderTags,
    measurementUnits,
    loyaltyRate,
  });

  if (!updatePayload) {
    res.status(400).json({ data: null, error: 'Не переданы валидные данные брендинга' });
    return;
  }

  try {
    const branding = await updateRestaurantBranding(updatePayload);
    res.json({ data: { branding }, error: null });
  } catch (error) {
    console.error('Failed to update restaurant branding:', error);
    res.status(400).json({ data: null, error: 'Некорректные данные брендинга' });
  }
}

router.post(
  '/branding/reset',
  requireRole('admin'),
  asyncHandler(async (_req: Request, res: Response) => {
    const branding = await resetRestaurantBranding();
    res.json({ data: { branding }, error: null });
  })
);

router.get(
  '/branding/defaults',
  requireRole('admin'),
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ data: { branding: restaurantBrandingDefaults }, error: null });
  })
);
export default router;
