import { Router, type Request, type RequestHandler, type Response } from 'express';
import { Types } from 'mongoose';

import { authMiddleware, requireRole } from '../middleware/auth';
import {
  getDailyReport,
  getSummaryReport,
  getTopCustomers,
  getTopProducts,
} from '../services/reportService';

const router = Router();
const ADMIN_ROLE = ['owner', 'superAdmin'];

const asyncHandler = (handler: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

const getOrganizationObjectId = (req: Request): Types.ObjectId | null => {
  const organizationId = req.organization?.id;

  if (organizationId && Types.ObjectId.isValid(organizationId)) {
    return new Types.ObjectId(organizationId);
  }

  if (
    req.user?.role === 'superAdmin' &&
    typeof req.query.organizationId === 'string' &&
    Types.ObjectId.isValid(req.query.organizationId)
  ) {
    return new Types.ObjectId(req.query.organizationId);
  }

  return null;
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
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const summary = await getSummaryReport(organizationId);

    res.json({ data: summary, error: null });
  })
);

router.get(
  '/daily',
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

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

    const daily = await getDailyReport({
      organizationId,
      from: fromParam ?? undefined,
      to: exclusiveTo,
    });

    res.json({ data: daily, error: null });
  })
);

router.get(
  '/top-products',
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const limit = parseLimit(req.query.limit);

    if (req.query.limit !== undefined && !limit) {
      res.status(400).json({ data: null, error: 'limit must be a positive integer' });
      return;
    }

    const products = await getTopProducts(organizationId, limit ?? 5);

    res.json({ data: products, error: null });
  })
);

router.get(
  '/top-customers',
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const limit = parseLimit(req.query.limit);

    if (req.query.limit !== undefined && !limit) {
      res.status(400).json({ data: null, error: 'limit must be a positive integer' });
      return;
    }

    const customers = await getTopCustomers(organizationId, limit ?? 5);

    res.json({ data: customers, error: null });
  })
);

export default router;
