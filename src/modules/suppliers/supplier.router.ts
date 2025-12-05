import { Router, type Request, type RequestHandler, type Response } from 'express';
import { isValidObjectId, Types } from 'mongoose';

import { authMiddleware, requireRole } from '../../middleware/auth';
import { enforceActiveSubscription } from '../../middleware/subscription';
import { SupplierModel } from './supplier.model';

const router = Router();

router.use(authMiddleware);
router.use(requireRole(['owner', 'superAdmin']));
router.use(enforceActiveSubscription);

const asyncHandler = (handler: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organization?.id;

    if (!organizationId || !isValidObjectId(organizationId)) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const suppliers = await SupplierModel.find({ organizationId }).sort({ name: 1 });

    res.json({ data: suppliers, error: null });
  })
);

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { name, contactName, phone, email, address, notes } = req.body;
    const organizationId = req.organization?.id;

    if (!organizationId || !isValidObjectId(organizationId)) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    if (!name?.trim()) {
      res.status(400).json({ data: null, error: 'Name is required' });
      return;
    }

    const supplier = new SupplierModel({
      organizationId: new Types.ObjectId(organizationId),
      name: name.trim(),
      contactName: contactName?.trim(),
      phone: phone?.trim(),
      email: email?.trim(),
      address: address?.trim(),
      notes: notes?.trim(),
    });

    await supplier.save();

    res.status(201).json({ data: supplier, error: null });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const organizationId = req.organization?.id;

    if (!isValidObjectId(id)) {
      res.status(400).json({ data: null, error: 'Invalid supplier id' });
      return;
    }

    if (!organizationId || !isValidObjectId(organizationId)) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const { name, contactName, phone, email, address, notes } = req.body;

    const update: Record<string, unknown> = {};

    if (name !== undefined) {
      if (!name?.trim()) {
        res.status(400).json({ data: null, error: 'Name cannot be empty' });
        return;
      }
      update.name = name.trim();
    }

    if (contactName !== undefined) {
      update.contactName = contactName?.trim() || undefined;
    }

    if (phone !== undefined) {
      update.phone = phone?.trim() || undefined;
    }

    if (email !== undefined) {
      update.email = email?.trim() || undefined;
    }

    if (address !== undefined) {
      update.address = address?.trim() || undefined;
    }

    if (notes !== undefined) {
      update.notes = notes?.trim() || undefined;
    }

    const supplier = await SupplierModel.findOneAndUpdate({ _id: id, organizationId }, update, {
      new: true,
      runValidators: true,
    });

    if (!supplier) {
      res.status(404).json({ data: null, error: 'Supplier not found' });
      return;
    }

    res.json({ data: supplier, error: null });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const organizationId = req.organization?.id;

    if (!isValidObjectId(id)) {
      res.status(400).json({ data: null, error: 'Invalid supplier id' });
      return;
    }

    if (!organizationId || !isValidObjectId(organizationId)) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const supplier = await SupplierModel.findOne({ _id: id, organizationId });

    if (!supplier) {
      res.status(404).json({ data: null, error: 'Supplier not found' });
      return;
    }

    await supplier.deleteOne();

    res.json({ data: { id: supplier.id }, error: null });
  })
);

export default router;
