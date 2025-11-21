import { Router, type RequestHandler } from 'express';

import { authMiddleware, requireRole } from '../../middleware/auth';
import { CustomerModel } from './customer.model';

const router = Router();
const MANAGER_ROLES = ['admin', 'cashier', 'owner', 'superAdmin'];

const asyncHandler = (handler: RequestHandler): RequestHandler => {
  return (async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  }) as RequestHandler;
};

router.use(authMiddleware);
router.use(requireRole(MANAGER_ROLES));

const requireOrganization: RequestHandler = (req, res, next) => {
  const organizationId = req.organization?.id;

  if (!organizationId) {
    res.status(400).json({ data: null, error: 'organizationId is required' });
    return;
  }

  next();
};

router.use(requireOrganization);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const organizationId = req.organization!.id;
    const customers = await CustomerModel.find({ organizationId }).sort({ createdAt: -1 }).lean();

    res.json({ data: customers, error: null });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      res.status(400).json({ data: null, error: 'Customer id is required' });
      return;
    }

    const organizationId = req.organization!.id;

    const customer = await CustomerModel.findOne({ _id: id.trim(), organizationId });

    if (!customer) {
      res.status(404).json({ data: null, error: 'Customer not found' });
      return;
    }

    res.json({ data: customer, error: null });
  })
);

router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const { phone } = req.query;

    if (!phone || typeof phone !== 'string') {
      res.status(400).json({ data: null, error: 'phone query parameter is required' });
      return;
    }

    const organizationId = req.organization!.id;

    const customer = await CustomerModel.findOne({ phone: phone.trim(), organizationId });

    if (!customer) {
      res.status(404).json({ data: null, error: 'Customer not found' });
      return;
    }

    res.json({ data: customer, error: null });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, phone, email } = req.body ?? {};

    if (!name || typeof name !== 'string') {
      res.status(400).json({ data: null, error: 'name is required' });
      return;
    }

    if (!phone || typeof phone !== 'string') {
      res.status(400).json({ data: null, error: 'phone is required' });
      return;
    }

    if (email !== undefined && email !== null && typeof email !== 'string') {
      res.status(400).json({ data: null, error: 'email must be a string when provided' });
      return;
    }

    const organizationId = req.organization!.id;

    try {
      const customer = await CustomerModel.create({
        name: name.trim(),
        phone: phone.trim(),
        email: email?.trim() || undefined,
        organizationId,
      });

      res.status(201).json({ data: customer, error: null });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: number }).code === 11000
      ) {
        res.status(409).json({ data: null, error: 'Customer with this phone already exists' });
        return;
      }

      throw error;
    }
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      res.status(400).json({ data: null, error: 'Customer id is required' });
      return;
    }

    const { name, phone, email, points, totalSpent } = req.body ?? {};
    const organizationId = req.organization!.id;
    const update: Record<string, unknown> = {};

    if (name !== undefined) {
      if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ data: null, error: 'Invalid name' });
        return;
      }
      update.name = name.trim();
    }

    if (phone !== undefined) {
      if (!phone || typeof phone !== 'string' || !phone.trim()) {
        res.status(400).json({ data: null, error: 'Invalid phone' });
        return;
      }
      update.phone = phone.trim();
    }

    if (email !== undefined) {
      if (email !== null && typeof email !== 'string') {
        res.status(400).json({ data: null, error: 'email must be a string or null' });
        return;
      }
      update.email = email ? email.trim() : undefined;
    }

    if (points !== undefined) {
      const normalized = Number(points);
      if (Number.isNaN(normalized) || normalized < 0) {
        res.status(400).json({ data: null, error: 'points must be a non-negative number' });
        return;
      }
      update.points = normalized;
    }

    if (totalSpent !== undefined) {
      const normalized = Number(totalSpent);
      if (Number.isNaN(normalized) || normalized < 0) {
        res.status(400).json({ data: null, error: 'totalSpent must be a non-negative number' });
        return;
      }
      update.totalSpent = normalized;
    }

    if (Object.keys(update).length === 0) {
      res.status(400).json({ data: null, error: 'No valid fields to update' });
      return;
    }

    try {
    const customer = await CustomerModel.findOneAndUpdate({ _id: id.trim(), organizationId }, update, {
      new: true,
      runValidators: true,
    });

      if (!customer) {
        res.status(404).json({ data: null, error: 'Customer not found' });
        return;
      }

      res.json({ data: customer, error: null });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: number }).code === 11000
      ) {
        res.status(409).json({ data: null, error: 'Customer with this phone already exists' });
        return;
      }

      throw error;
    }
  })
);

export default router;
