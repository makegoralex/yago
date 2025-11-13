import { Router, type Request, type RequestHandler, type Response } from 'express';

import { authMiddleware, requireRole } from '../middleware/auth';
import {
  getDailyReport,
  getSummaryReport,
  getTopCustomers,
  getTopProducts,
} from '../services/reportService';

const router = Router();
const ADMIN_ROLE = ['admin'];

const asyncHandler = (handler: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

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

const parseLimit = (value: unknown): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
};

router.use(authMiddleware);
router.use(requireRole(ADMIN_ROLE));

router.get(
  '/summary',
  asyncHandler(async (_req: Request, res: Response) => {
    const summary = await getSummaryReport();

    res.json({ data: summary, error: null });
  })
);

router.get(
  '/daily',
  asyncHandler(async (req: Request, res: Response) => {
    const fromParam = parseDateOnly(req.query.from);
    const toParam = parseDateOnly(req.query.to);

    if (req.query.from && !fromParam) {
      res.status(400).json({ data: null, error: 'from must be in YYYY-MM-DD format' });
      return;
    }

    if (req.query.to && !toParam) {
      res.status(400).json({ data: null, error: 'to must be in YYYY-MM-DD format' });
      return;
    }

    if (fromParam && toParam && fromParam > toParam) {
      res.status(400).json({ data: null, error: 'from must be earlier than to' });
      return;
    }

    const exclusiveTo = toParam
      ? new Date(toParam.getTime() + 24 * 60 * 60 * 1000)
      : undefined;

    const daily = await getDailyReport({ from: fromParam ?? undefined, to: exclusiveTo });

    res.json({ data: daily, error: null });
  })
);

router.get(
  '/top-products',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseLimit(req.query.limit);

    if (req.query.limit !== undefined && !limit) {
      res.status(400).json({ data: null, error: 'limit must be a positive integer' });
      return;
    }

    const products = await getTopProducts(limit ?? 5);

    res.json({ data: products, error: null });
  })
);

router.get(
  '/top-customers',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseLimit(req.query.limit);

    if (req.query.limit !== undefined && !limit) {
      res.status(400).json({ data: null, error: 'limit must be a positive integer' });
      return;
    }

    const customers = await getTopCustomers(limit ?? 5);

    res.json({ data: customers, error: null });
  })
);

export default router;
