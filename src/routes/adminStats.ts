import { Router, type Request, type RequestHandler, type Response } from 'express';

import { authMiddleware, requireRole } from '../middleware/auth';
import { getSalesAndShiftStats } from '../services/adminDashboardService';

const router = Router();
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const ALLOWED_ROLES = ['admin', 'barista'];

const parseDateOnly = (value: unknown): Date | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const asyncHandler = (handler: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

router.use(authMiddleware);

router.get(
  '/sales-and-shifts',
  requireRole(ALLOWED_ROLES),
  asyncHandler(async (req: Request, res: Response) => {
    const fromParam = parseDateOnly(req.query.from);
    const toParam = parseDateOnly(req.query.to);

    if (req.query.from && !fromParam) {
      res.status(400).json({ data: null, error: 'from должен быть в формате YYYY-MM-DD' });
      return;
    }

    if (req.query.to && !toParam) {
      res.status(400).json({ data: null, error: 'to должен быть в формате YYYY-MM-DD' });
      return;
    }

    if (fromParam && toParam && fromParam > toParam) {
      res
        .status(400)
        .json({ data: null, error: 'from должен быть меньше или равен значению to' });
      return;
    }

    const exclusiveTo = toParam ? new Date(toParam.getTime() + DAY_IN_MS) : undefined;

    const stats = await getSalesAndShiftStats({
      from: fromParam ?? undefined,
      to: exclusiveTo,
    });

    res.json({
      data: {
        ...stats,
        period: {
          from: fromParam ? fromParam.toISOString() : undefined,
          to: toParam ? toParam.toISOString() : undefined,
        },
      },
      error: null,
    });
  })
);

export default router;
