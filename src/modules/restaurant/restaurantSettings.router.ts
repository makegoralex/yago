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

function extractBrandingUpdatePayload(body: unknown): Partial<RestaurantBranding> | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const { name, logoUrl, enableOrderTags, measurementUnits, loyaltyRate } = body as Record<string, unknown>;

  const updatePayload: Partial<RestaurantBranding> = {
    name: typeof name === 'string' ? name : undefined,
    logoUrl: typeof logoUrl === 'string' ? logoUrl : undefined,
    enableOrderTags: typeof enableOrderTags === 'boolean' ? enableOrderTags : undefined,
    measurementUnits: Array.isArray(measurementUnits) ? measurementUnits : undefined,
    loyaltyRate: typeof loyaltyRate === 'number' ? loyaltyRate : undefined,
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

    const branding = await updateRestaurantBranding(updatePayload);

    res.json({ data: { branding }, error: null });
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

  const branding = await updateRestaurantBranding(updatePayload);

  res.json({ data: { branding }, error: null });
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
