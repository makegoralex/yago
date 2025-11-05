import { Router, type RequestHandler } from 'express';
import { isValidObjectId } from 'mongoose';

import { authMiddleware, requireRole } from '../../middleware/auth';
import { CategoryModel, ProductModel } from './catalog.model';

const router = Router();

router.use(authMiddleware);

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
  '/categories',
  asyncHandler(async (_req, res) => {
    const categories = await CategoryModel.find().sort({ sortOrder: 1, name: 1 });

    res.json({ data: categories, error: null });
  })
);

router.post(
  '/categories',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { name, sortOrder } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ data: null, error: 'Name is required' });
      return;
    }

    const category = new CategoryModel({ name: name.trim(), sortOrder });
    await category.save();

    res.status(201).json({ data: category, error: null });
  })
);

router.put(
  '/categories/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      res.status(400).json({ data: null, error: 'Invalid category id' });
      return;
    }

    const { name, sortOrder } = req.body;

    if (name !== undefined && !name?.trim()) {
      res.status(400).json({ data: null, error: 'Name cannot be empty' });
      return;
    }

    const update: Record<string, unknown> = {};

    if (name !== undefined) {
      update.name = name.trim();
    }

    if (sortOrder !== undefined) {
      update.sortOrder = sortOrder;
    }

    const category = await CategoryModel.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    if (!category) {
      res.status(404).json({ data: null, error: 'Category not found' });
      return;
    }

    res.json({ data: category, error: null });
  })
);

router.delete(
  '/categories/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      res.status(400).json({ data: null, error: 'Invalid category id' });
      return;
    }

    const category = await CategoryModel.findById(id);

    if (!category) {
      res.status(404).json({ data: null, error: 'Category not found' });
      return;
    }

    await category.deleteOne();

    res.json({ data: { id: category.id }, error: null });
  })
);

router.get(
  '/products',
  asyncHandler(async (req, res) => {
    const { categoryId } = req.query;

    const filter: Record<string, unknown> = {};

    if (categoryId) {
      if (typeof categoryId !== 'string' || !isValidObjectId(categoryId)) {
        res.status(400).json({ data: null, error: 'Invalid categoryId filter' });
        return;
      }

      filter.categoryId = categoryId;
    }

    const products = await ProductModel.find(filter).sort({ name: 1 });

    res.json({ data: products, error: null });
  })
);

router.post(
  '/products',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { name, categoryId, price, modifiers, isActive } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ data: null, error: 'Name is required' });
      return;
    }

    if (!categoryId || !isValidObjectId(categoryId)) {
      res.status(400).json({ data: null, error: 'Valid categoryId is required' });
      return;
    }

    if (price === undefined || typeof price !== 'number' || Number.isNaN(price) || price < 0) {
      res.status(400).json({ data: null, error: 'Valid price is required' });
      return;
    }

    if (isActive !== undefined && typeof isActive !== 'boolean') {
      res.status(400).json({ data: null, error: 'isActive must be a boolean' });
      return;
    }

    const categoryExists = await CategoryModel.exists({ _id: categoryId });

    if (!categoryExists) {
      res.status(400).json({ data: null, error: 'Category not found' });
      return;
    }

    let normalizedModifiers: string[] | undefined;

    if (modifiers !== undefined) {
      if (!Array.isArray(modifiers) || !modifiers.every((item) => typeof item === 'string')) {
        res
          .status(400)
          .json({ data: null, error: 'Modifiers must be an array of strings' });
        return;
      }

      normalizedModifiers = (modifiers as string[])
        .map((modifier) => modifier.trim())
        .filter(Boolean);
    }

    const product = new ProductModel({
      name: name.trim(),
      categoryId,
      price,
      modifiers: normalizedModifiers,
      isActive,
    });

    await product.save();

    res.status(201).json({ data: product, error: null });
  })
);

router.put(
  '/products/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      res.status(400).json({ data: null, error: 'Invalid product id' });
      return;
    }

    const { name, categoryId, price, modifiers, isActive } = req.body;

    if (name !== undefined && !name?.trim()) {
      res.status(400).json({ data: null, error: 'Name cannot be empty' });
      return;
    }

    if (categoryId !== undefined) {
      if (!isValidObjectId(categoryId)) {
        res.status(400).json({ data: null, error: 'Invalid categoryId' });
        return;
      }

      const categoryExists = await CategoryModel.exists({ _id: categoryId });

      if (!categoryExists) {
        res.status(400).json({ data: null, error: 'Category not found' });
        return;
      }
    }

    if (
      price !== undefined &&
      (typeof price !== 'number' || Number.isNaN(price) || price < 0)
    ) {
      res.status(400).json({ data: null, error: 'Invalid price' });
      return;
    }

    if (isActive !== undefined && typeof isActive !== 'boolean') {
      res.status(400).json({ data: null, error: 'isActive must be a boolean' });
      return;
    }

    const update: Record<string, unknown> = {};

    if (name !== undefined) {
      update.name = name.trim();
    }

    if (categoryId !== undefined) {
      update.categoryId = categoryId;
    }

    if (price !== undefined) {
      update.price = price;
    }

    if (modifiers !== undefined) {
      if (!Array.isArray(modifiers) || !modifiers.every((item) => typeof item === 'string')) {
        res
          .status(400)
          .json({ data: null, error: 'Modifiers must be an array of strings' });
        return;
      }

      update.modifiers = (modifiers as string[])
        .map((modifier) => modifier.trim())
        .filter(Boolean);
    }

    if (isActive !== undefined) {
      update.isActive = isActive;
    }

    const product = await ProductModel.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      res.status(404).json({ data: null, error: 'Product not found' });
      return;
    }

    res.json({ data: product, error: null });
  })
);

router.delete(
  '/products/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      res.status(400).json({ data: null, error: 'Invalid product id' });
      return;
    }

    const product = await ProductModel.findById(id);

    if (!product) {
      res.status(404).json({ data: null, error: 'Product not found' });
      return;
    }

    await product.deleteOne();

    res.json({ data: { id: product.id }, error: null });
  })
);

export default router;
