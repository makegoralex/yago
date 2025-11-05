import { Router, type RequestHandler } from 'express';

import { authMiddleware, requireRole } from '../../middleware/auth';
import { CustomerModel } from './customer.model';

const router = Router();
const MANAGER_ROLES = ['admin', 'cashier'];

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

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const customers = await CustomerModel.find().sort({ createdAt: -1 });

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

    const customer = await CustomerModel.findById(id.trim());

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

    const customer = await CustomerModel.findOne({ phone: phone.trim() });

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

    try {
      const customer = await CustomerModel.create({
        name: name.trim(),
        phone: phone.trim(),
        email: email?.trim() || undefined,
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

export default router;
