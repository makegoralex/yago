import { Router, type Request, type RequestHandler } from 'express';
import { FilterQuery, isValidObjectId, Types } from 'mongoose';

import { authMiddleware, requireRole } from '../../middleware/auth';
import { OrderModel, type OrderDocument, type OrderStatus } from '../orders/order.model';
import { ShiftModel, type ShiftDocument, type ShiftTotals } from './shift.model';

const router = Router();
const SHIFT_ROLES = ['admin', 'cashier', 'barista', 'owner', 'superAdmin'];
const FULFILLED_ORDER_STATUSES: OrderStatus[] = ['paid', 'completed'];

const asyncHandler = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const getOrganizationObjectId = (req: Request): Types.ObjectId | null => {
  const organizationId = req.organization?.id;

  if (!organizationId || !isValidObjectId(organizationId)) {
    return null;
  }

  return new Types.ObjectId(organizationId);
};

const buildShiftOrderFilter = (
  shift: ShiftDocument,
  until?: Date
): FilterQuery<OrderDocument> => {
  const range: Record<string, Date> = { $gte: shift.openedAt };
  const endDate = until ?? shift.closedAt;

  if (endDate) {
    range.$lte = endDate;
  }

  return {
    orgId: shift.orgId,
    organizationId: shift.organizationId,
    locationId: shift.locationId,
    registerId: shift.registerId,
    status: { $in: FULFILLED_ORDER_STATUSES },
    createdAt: range,
  } as FilterQuery<OrderDocument>;
};

const calculateShiftTotals = async (
  shift: ShiftDocument,
  until?: Date
): Promise<ShiftTotals> => {
  const match = buildShiftOrderFilter(shift, until);
  const breakdown = await OrderModel.aggregate<{ _id: string | null; amount: number }>([
    { $match: match },
    {
      $group: {
        _id: '$payment.method',
        amount: { $sum: '$total' },
      },
    },
  ]);

  const totals: ShiftTotals = { cash: 0, card: 0, total: 0 };

  for (const entry of breakdown) {
    const method = entry._id === 'card' ? 'card' : 'cash';
    const amount = typeof entry.amount === 'number' ? entry.amount : 0;
    totals[method] += amount;
    totals.total += amount;
  }

  return totals;
};

router.use(authMiddleware);

const openShiftHandler: RequestHandler = asyncHandler(async (req, res) => {
    const { locationId, registerId, openingBalance, openingNote } = req.body ?? {};
    const organizationId = getOrganizationObjectId(req);
    const cashierId = req.user?.id;

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    if (!cashierId) {
      res.status(403).json({ data: null, error: 'Unable to determine cashier' });
      return;
    }

    if (!locationId || !registerId) {
      res.status(400).json({ data: null, error: 'locationId and registerId are required' });
      return;
    }

    const normalizedOrgId = organizationId.toString();
    const normalizedLocationId = String(locationId).trim();
    const normalizedRegisterId = String(registerId).trim();

    const existingShift = await ShiftModel.findOne({
      registerId: normalizedRegisterId,
      organizationId,
      status: 'open',
    }).sort({ openedAt: -1 });

    if (existingShift) {
      res.status(409).json({ data: null, error: 'На кассе уже есть открытая смена' });
      return;
    }

    let normalizedOpeningBalance: number | undefined;
    if (openingBalance !== undefined) {
      const numeric = Number(openingBalance);
      if (Number.isNaN(numeric) || numeric < 0) {
        res.status(400).json({ data: null, error: 'openingBalance must be a positive number' });
        return;
      }
      normalizedOpeningBalance = numeric;
    }

    const shift = await ShiftModel.create({
      orgId: normalizedOrgId,
      organizationId,
      locationId: normalizedLocationId,
      registerId: normalizedRegisterId,
      cashierId: new Types.ObjectId(cashierId),
      openedBy: new Types.ObjectId(cashierId),
      openedAt: new Date(),
      openingBalance: normalizedOpeningBalance,
      openingNote: typeof openingNote === 'string' ? openingNote.trim() : undefined,
      status: 'open',
    });

    res.status(201).json({ data: shift, error: null });
  });

router.post('/', requireRole(SHIFT_ROLES), openShiftHandler);
router.post('/open', requireRole(SHIFT_ROLES), openShiftHandler);

router.post(
  '/:id/close',
  requireRole(SHIFT_ROLES),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationObjectId(req);
    if (!isValidObjectId(id)) {
      res.status(400).json({ data: null, error: 'Invalid shift id' });
      return;
    }

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const shift = await ShiftModel.findOne({ _id: id, organizationId });
    if (!shift) {
      res.status(404).json({ data: null, error: 'Shift not found' });
      return;
    }

    if (shift.status === 'closed') {
      res.status(409).json({ data: null, error: 'Смена уже закрыта' });
      return;
    }

    const userId = req.user?.id;
    const isAdmin = ['admin', 'owner', 'superAdmin'].includes(req.user?.role ?? '');
    if (!isAdmin && (!userId || shift.cashierId.toString() !== userId)) {
      res.status(403).json({ data: null, error: 'Forbidden' });
      return;
    }

    const closingMoment = new Date();
    const { closingBalance, closingNote } = req.body ?? {};

    if (closingBalance !== undefined) {
      const numeric = Number(closingBalance);
      if (Number.isNaN(numeric) || numeric < 0) {
        res.status(400).json({ data: null, error: 'closingBalance must be a positive number' });
        return;
      }
      shift.closingBalance = numeric;
    }

    if (typeof closingNote === 'string') {
      shift.closingNote = closingNote.trim();
    }

    shift.closedAt = closingMoment;
    shift.closedBy = userId ? new Types.ObjectId(userId) : undefined;
    shift.totals = await calculateShiftTotals(shift, closingMoment);

    await shift.save();

    res.json({ data: shift, error: null });
  })
);

router.get(
  '/current',
  requireRole(SHIFT_ROLES),
  asyncHandler(async (req, res) => {
    const { registerId, cashierId: cashierParam } = req.query;
    const organizationId = getOrganizationObjectId(req);
    const filter: FilterQuery<ShiftDocument> = { status: 'open' };

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    filter.organizationId = organizationId;

    if (typeof registerId === 'string' && registerId.trim()) {
      filter.registerId = registerId.trim();
    }

    if (typeof cashierParam === 'string' && cashierParam.trim()) {
      if (!isValidObjectId(cashierParam)) {
        res.status(400).json({ data: null, error: 'cashierId must be a valid identifier' });
        return;
      }
      filter.cashierId = new Types.ObjectId(cashierParam.trim());
    } else if (!filter.registerId && req.user?.id) {
      filter.cashierId = new Types.ObjectId(req.user.id);
    }

    const shift = await ShiftModel.findOne(filter).sort({ openedAt: -1 });

    res.json({ data: shift ?? null, error: null });
  })
);

export default router;
