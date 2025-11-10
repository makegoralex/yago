import { Router, type RequestHandler } from 'express';
import { isValidObjectId } from 'mongoose';

import { authMiddleware, requireRole } from '../../middleware/auth';
import { SupplierModel } from './supplier.model';

const router = Router();

router.use(authMiddleware);
router.use(requireRole('admin'));

const asyncHandler = (handler: RequestHandler): RequestHandler => {
  return (async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  }) as RequestHandler;
};

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const suppliers = await SupplierModel.find().sort({ name: 1 });

    res.json({ data: suppliers, error: null });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, contactName, phone, email, address, notes } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ data: null, error: 'Name is required' });
      return;
    }

    const supplier = new SupplierModel({
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
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      res.status(400).json({ data: null, error: 'Invalid supplier id' });
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

    const supplier = await SupplierModel.findByIdAndUpdate(id, update, {
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
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      res.status(400).json({ data: null, error: 'Invalid supplier id' });
      return;
    }

    const supplier = await SupplierModel.findById(id);

    if (!supplier) {
      res.status(404).json({ data: null, error: 'Supplier not found' });
      return;
    }

    await supplier.deleteOne();

    res.json({ data: { id: supplier.id }, error: null });
  })
);

export default router;
