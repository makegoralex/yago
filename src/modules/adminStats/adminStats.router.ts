import { Router, type Request, type RequestHandler, type Response } from 'express';

import { authMiddleware, requireRole } from '../../middleware/auth';
import { fetchSalesAndShiftStats } from './adminStats.service';

const router = Router();
const ADMIN_ROLES = ['admin'];

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
router.use(requireRole(ADMIN_ROLES));

router.get(
  '/sales-and-shifts',
  asyncHandler(async (req: Request, res: Response) => {
    const from = parseDateOnly(req.query.from);
    const to = parseDateOnly(req.query.to);

    if (req.query.from && !from) {
      res.status(400).json({ data: null, error: 'from должен быть в формате YYYY-MM-DD' });
      return;
    }

    if (req.query.to && !to) {
      res.status(400).json({ data: null, error: 'to должен быть в формате YYYY-MM-DD' });
      return;
    }

    if (from && to && from > to) {
      res.status(400).json({ data: null, error: 'from должен быть меньше или равен to' });
      return;
    }

    const stats = await fetchSalesAndShiftStats({ from, to });

    res.json({ data: stats, error: null });
  })
);

export default router;
