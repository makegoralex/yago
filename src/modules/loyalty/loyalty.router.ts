import { Router, type RequestHandler } from 'express';
import { isValidObjectId, Types } from 'mongoose';

import { authMiddleware, requireRole } from '../../middleware/auth';
import { OrderModel } from '../orders/order.model';
import { earnLoyaltyPoints, redeemLoyaltyPoints } from './loyalty.service';

const router = Router();
const MANAGER_ROLES = ['cashier', 'owner', 'superAdmin'];

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

router.post(
  '/earn',
  asyncHandler(async (req, res) => {
    const { customerId, orderId, amount } = req.body ?? {};

    if (!customerId || typeof customerId !== 'string' || !isValidObjectId(customerId)) {
      res.status(400).json({ data: null, error: 'A valid customerId is required' });
      return;
    }

    if (!orderId || typeof orderId !== 'string' || !isValidObjectId(orderId)) {
      res.status(400).json({ data: null, error: 'A valid orderId is required' });
      return;
    }

    if (typeof amount !== 'number' || Number.isNaN(amount) || amount <= 0) {
      res.status(400).json({ data: null, error: 'amount must be a positive number' });
      return;
    }

    const order = await OrderModel.findById(orderId);

    if (!order) {
      res.status(404).json({ data: null, error: 'Order not found' });
      return;
    }

    if (order.customerId && order.customerId.toString() !== customerId) {
      res.status(400).json({ data: null, error: 'Order is linked to a different customer' });
      return;
    }

    if (order.status === 'draft') {
      res.status(400).json({ data: null, error: 'Order must be paid before awarding points' });
      return;
    }

    if (order.status !== 'paid' && order.status !== 'completed') {
      res.status(400).json({ data: null, error: 'Only paid orders accrue loyalty points' });
      return;
    }

    if (!order.customerId) {
      order.customerId = new Types.ObjectId(customerId);
      await order.save();
    }

    try {
      const result = await earnLoyaltyPoints(customerId, amount);

      res.json({ data: result, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to apply loyalty points';
      res.status(400).json({ data: null, error: message });
    }
  })
);

router.post(
  '/redeem',
  asyncHandler(async (req, res) => {
    const { customerId, points } = req.body ?? {};

    if (!customerId || typeof customerId !== 'string' || !isValidObjectId(customerId)) {
      res.status(400).json({ data: null, error: 'A valid customerId is required' });
      return;
    }

    if (typeof points !== 'number' || Number.isNaN(points) || points <= 0) {
      res.status(400).json({ data: null, error: 'points must be a positive number' });
      return;
    }

    try {
      const customer = await redeemLoyaltyPoints(customerId, points);

      res.json({ data: { customer, pointsRedeemed: points }, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to redeem loyalty points';
      res.status(400).json({ data: null, error: message });
    }
  })
);

export default router;
