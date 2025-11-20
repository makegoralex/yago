import { Router, type RequestHandler } from 'express';
import { isValidObjectId, Types } from 'mongoose';

import { authMiddleware, requireRole } from '../../middleware/auth';
import { CategoryModel, ProductModel, type ProductIngredient } from './catalog.model';
import { IngredientModel } from './ingredient.model';
import { ModifierGroupModel, type ModifierOption } from './modifierGroup.model';
import { recalculateProductCost, recalculateProductsForIngredient } from './productCost.service';
import { canConvertUnit } from './unitConversion';

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

const normalizeIngredients = async (
  ingredients: unknown
): Promise<ProductIngredient[] | undefined> => {
  if (ingredients === undefined) {
    return undefined;
  }

  if (!Array.isArray(ingredients)) {
    throw new Error('Ingredients must be an array');
  }

  if (ingredients.length === 0) {
    return [];
  }

  const ingredientIds = new Set<string>();
  const collected: Array<{ ingredientId: string; quantity: number; unit?: string }> = [];

  for (const entry of ingredients) {
    if (!entry || typeof entry !== 'object') {
      throw new Error('Invalid ingredient entry');
    }

    const { ingredientId, quantity, unit } = entry as {
      ingredientId?: string;
      quantity?: number;
      unit?: string;
    };

    if (!ingredientId || !isValidObjectId(ingredientId)) {
      throw new Error('Ingredient id is required');
    }

    if (ingredientIds.has(ingredientId)) {
      throw new Error('Ingredient list contains duplicates');
    }

    if (quantity === undefined || typeof quantity !== 'number' || Number.isNaN(quantity) || quantity <= 0) {
      throw new Error('Ingredient quantity must be a positive number');
    }

    ingredientIds.add(ingredientId);
    collected.push({ ingredientId, quantity, unit: typeof unit === 'string' ? unit.trim() : undefined });
  }

  const ingredientsData = await IngredientModel.find({ _id: { $in: Array.from(ingredientIds) } })
    .select('_id unit')
    .lean();

  if (ingredientsData.length !== ingredientIds.size) {
    throw new Error('Ingredient not found');
  }

  const ingredientUnitMap = new Map(ingredientsData.map((entry) => [entry._id.toString(), entry.unit]));

  const normalized: ProductIngredient[] = collected.map(({ ingredientId, quantity, unit }) => {
    const ingredientUnit = ingredientUnitMap.get(ingredientId);

    if (!ingredientUnit) {
      throw new Error('Ingredient unit is missing');
    }

    const effectiveUnit = unit?.trim() || ingredientUnit;

    if (!canConvertUnit(effectiveUnit, ingredientUnit)) {
      throw new Error('Ingredient unit is not compatible');
    }

    return {
      ingredientId: new Types.ObjectId(ingredientId),
      quantity,
      unit: effectiveUnit,
    };
  });

  return normalized;
};

const normalizeModifierGroups = async (
  modifierGroups: unknown
): Promise<Types.ObjectId[] | undefined> => {
  if (modifierGroups === undefined) {
    return undefined;
  }

  if (modifierGroups === null) {
    return [];
  }

  if (!Array.isArray(modifierGroups)) {
    throw new Error('modifierGroups must be an array of ids');
  }

  if (modifierGroups.length === 0) {
    return [];
  }

  const uniqueIds = new Set<string>();

  for (const id of modifierGroups) {
    if (typeof id !== 'string' || !isValidObjectId(id)) {
      throw new Error('modifierGroups must be a list of valid ids');
    }

    uniqueIds.add(id);
  }

  const existing = await ModifierGroupModel.find({ _id: { $in: Array.from(uniqueIds) } })
    .select('_id')
    .lean();

  if (existing.length !== uniqueIds.size) {
    throw new Error('One or more modifier groups were not found');
  }

  return Array.from(uniqueIds, (id) => new Types.ObjectId(id));
};

const computeProductPricing = (
  basePriceInput: unknown,
  priceInput: unknown,
  discountTypeInput: unknown,
  discountValueInput: unknown
) => {
  const basePriceRaw =
    basePriceInput !== undefined ? Number(basePriceInput) : priceInput !== undefined ? Number(priceInput) : undefined;

  if (basePriceRaw === undefined || Number.isNaN(basePriceRaw) || basePriceRaw < 0) {
    throw new Error('Valid basePrice or price is required');
  }

  const discountType =
    discountTypeInput === 'percentage' || discountTypeInput === 'fixed' ? discountTypeInput : undefined;

  const discountValue = discountValueInput !== undefined ? Number(discountValueInput) : undefined;

  if (discountType && (discountValue === undefined || Number.isNaN(discountValue) || discountValue < 0)) {
    throw new Error('discountValue must be a positive number');
  }

  let finalPrice = priceInput !== undefined ? Number(priceInput) : basePriceRaw;

  if (discountType) {
    if (discountType === 'percentage') {
      if (discountValue === undefined || discountValue > 100) {
        throw new Error('discountValue must be between 0 and 100 for percentage discounts');
      }
      finalPrice = basePriceRaw * (1 - discountValue / 100);
    } else {
      finalPrice = basePriceRaw - (discountValue ?? 0);
    }
  }

  if (Number.isNaN(finalPrice) || finalPrice < 0) {
    finalPrice = 0;
  }

  return {
    basePrice: Number(basePriceRaw.toFixed(2)),
    price: Number(finalPrice.toFixed(2)),
    discountType: discountType ?? undefined,
    discountValue: discountValue ?? undefined,
  };
};

router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const categories = await CategoryModel.find().sort({ sortOrder: 1, name: 1 });

    res.json({ data: categories, error: null });
  })
);

router.get(
  '/modifier-groups',
  asyncHandler(async (_req, res) => {
    const groups = await ModifierGroupModel.find().sort({ sortOrder: 1, name: 1 });

    res.json({ data: groups, error: null });
  })
);

router.post(
  '/modifier-groups',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { name, selectionType, required, sortOrder, options } = req.body ?? {};

    if (!name?.trim()) {
      res.status(400).json({ data: null, error: 'Name is required' });
      return;
    }

    if (selectionType !== 'single' && selectionType !== 'multiple') {
      res.status(400).json({ data: null, error: 'selectionType must be single or multiple' });
      return;
    }

    if (required !== undefined && typeof required !== 'boolean') {
      res.status(400).json({ data: null, error: 'required must be a boolean' });
      return;
    }

    if (options !== undefined && !Array.isArray(options)) {
      res.status(400).json({ data: null, error: 'options must be an array' });
      return;
    }

      const normalizedOptions: ModifierOption[] = (options ?? []).map((option: any) => ({
        name: String(option?.name ?? '').trim(),
        priceChange: Number(option?.priceChange ?? 0),
        costChange: Number(option?.costChange ?? 0),
      }));

      if (normalizedOptions.some((option: ModifierOption) => !option.name)) {
        res.status(400).json({ data: null, error: 'Each option must have a name' });
        return;
      }

    const group = new ModifierGroupModel({
      name: name.trim(),
      selectionType,
      required: Boolean(required),
      sortOrder,
      options: normalizedOptions,
    });

    await group.save();

    res.status(201).json({ data: group, error: null });
  })
);

router.put(
  '/modifier-groups/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, selectionType, required, sortOrder, options } = req.body ?? {};

    if (!isValidObjectId(id)) {
      res.status(400).json({ data: null, error: 'Invalid modifier group id' });
      return;
    }

    const update: Record<string, unknown> = {};

    if (name !== undefined) {
      if (!String(name).trim()) {
        res.status(400).json({ data: null, error: 'Name cannot be empty' });
        return;
      }

      update.name = String(name).trim();
    }

    if (selectionType !== undefined) {
      if (selectionType !== 'single' && selectionType !== 'multiple') {
        res.status(400).json({ data: null, error: 'selectionType must be single or multiple' });
        return;
      }

      update.selectionType = selectionType;
    }

    if (required !== undefined) {
      if (typeof required !== 'boolean') {
        res.status(400).json({ data: null, error: 'required must be a boolean' });
        return;
      }

      update.required = required;
    }

    if (sortOrder !== undefined) {
      update.sortOrder = sortOrder;
    }

    if (options !== undefined) {
      if (!Array.isArray(options)) {
        res.status(400).json({ data: null, error: 'options must be an array' });
        return;
      }

      const normalizedOptions = options.map((option: any) => ({
        name: String(option?.name ?? '').trim(),
        priceChange: Number(option?.priceChange ?? 0),
        costChange: Number(option?.costChange ?? 0),
      }));

      if (normalizedOptions.some((option) => !option.name)) {
        res.status(400).json({ data: null, error: 'Each option must have a name' });
        return;
      }

      update.options = normalizedOptions;
    }

    const group = await ModifierGroupModel.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    if (!group) {
      res.status(404).json({ data: null, error: 'Modifier group not found' });
      return;
    }

    res.json({ data: group, error: null });
  })
);

router.delete(
  '/modifier-groups/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      res.status(400).json({ data: null, error: 'Invalid modifier group id' });
      return;
    }

    const group = await ModifierGroupModel.findById(id);

    if (!group) {
      res.status(404).json({ data: null, error: 'Modifier group not found' });
      return;
    }

    await group.deleteOne();

    res.json({ data: { id: group.id }, error: null });
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
    const { categoryId, includeInactive } = req.query;

    const filter: Record<string, unknown> = {};

    if (categoryId) {
      if (typeof categoryId !== 'string' || !isValidObjectId(categoryId)) {
        res.status(400).json({ data: null, error: 'Invalid categoryId filter' });
        return;
      }

      filter.categoryId = categoryId;
    }

    if (includeInactive !== 'true') {
      filter.isActive = { $ne: false };
    }

    const products = await ProductModel.find(filter)
      .populate('modifierGroups')
      .sort({ name: 1 });

    res.json({ data: products, error: null });
  })
);

router.post(
  '/products',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const {
      name,
      categoryId,
      price,
      basePrice,
      discountType,
      discountValue,
      modifierGroups,
      isActive,
      description,
      imageUrl,
      ingredients,
    } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ data: null, error: 'Name is required' });
      return;
    }

    if (!categoryId || !isValidObjectId(categoryId)) {
      res.status(400).json({ data: null, error: 'Valid categoryId is required' });
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

    let normalizedModifierGroups: Types.ObjectId[] | undefined;

    try {
      normalizedModifierGroups = await normalizeModifierGroups(modifierGroups);
    } catch (error) {
      res.status(400).json({ data: null, error: error instanceof Error ? error.message : 'Invalid modifierGroups' });
      return;
    }

    let normalizedIngredients: ProductIngredient[] | undefined;

    try {
      normalizedIngredients = await normalizeIngredients(ingredients);
    } catch (error) {
      res.status(400).json({ data: null, error: error instanceof Error ? error.message : 'Invalid ingredients' });
      return;
    }

    let pricing;

    try {
      pricing = computeProductPricing(basePrice, price, discountType, discountValue);
    } catch (error) {
      res.status(400).json({ data: null, error: error instanceof Error ? error.message : 'Invalid pricing data' });
      return;
    }

    const product = new ProductModel({
      name: name.trim(),
      categoryId,
      description: description?.trim(),
      imageUrl: imageUrl?.trim(),
      price: pricing.price,
      basePrice: pricing.basePrice,
      discountType: pricing.discountType,
      discountValue: pricing.discountValue,
      modifierGroups: normalizedModifierGroups,
      ingredients: normalizedIngredients,
      isActive,
    });

    await product.save();

    await recalculateProductCost(product._id as Types.ObjectId);

    res.status(201).json({ data: product, error: null });
  })
);

router.put(
  '/products/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const {
      name,
      categoryId,
      price,
      basePrice,
      discountType,
      discountValue,
      modifierGroups,
      isActive,
      description,
      imageUrl,
      ingredients,
    } = req.body;
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      res.status(400).json({ data: null, error: 'Invalid product id' });
      return;
    }

    const update: Record<string, unknown> = {};

    if (name !== undefined) {
      if (!name?.trim()) {
        res.status(400).json({ data: null, error: 'Name cannot be empty' });
        return;
      }
      update.name = name.trim();
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

      update.categoryId = categoryId;
    }

    if (modifierGroups !== undefined) {
      try {
        update.modifierGroups = await normalizeModifierGroups(modifierGroups);
      } catch (error) {
        res.status(400).json({ data: null, error: error instanceof Error ? error.message : 'Invalid modifierGroups' });
        return;
      }
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        res.status(400).json({ data: null, error: 'isActive must be a boolean' });
        return;
      }

      update.isActive = isActive;
    }

    if (description !== undefined) {
      update.description = description?.trim() || undefined;
    }

    if (imageUrl !== undefined) {
      update.imageUrl = imageUrl?.trim() || undefined;
    }

    if (ingredients !== undefined) {
      try {
        update.ingredients = await normalizeIngredients(ingredients);
      } catch (error) {
        res.status(400).json({ data: null, error: error instanceof Error ? error.message : 'Invalid ingredients' });
        return;
      }
    }

    if (
      price !== undefined ||
      basePrice !== undefined ||
      discountType !== undefined ||
      discountValue !== undefined
    ) {
      try {
        const pricing = computeProductPricing(
          basePrice ?? (update.basePrice as number | undefined),
          price ?? (update.price as number | undefined),
          discountType ?? (update.discountType as string | undefined),
          discountValue ?? (update.discountValue as number | undefined)
        );
        update.basePrice = pricing.basePrice;
        update.price = pricing.price;
        update.discountType = pricing.discountType;
        update.discountValue = pricing.discountValue;
      } catch (error) {
        res.status(400).json({ data: null, error: error instanceof Error ? error.message : 'Invalid pricing data' });
        return;
      }
    }

    const product = await ProductModel.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      res.status(404).json({ data: null, error: 'Product not found' });
      return;
    }

    await recalculateProductCost(product._id as Types.ObjectId);

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

router.get(
  '/ingredients',
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    const ingredients = await IngredientModel.find().sort({ name: 1 });

    res.json({ data: ingredients, error: null });
  })
);

router.post(
  '/ingredients',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { name, unit, costPerUnit, supplierId, description } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ data: null, error: 'Name is required' });
      return;
    }

    if (!unit?.trim()) {
      res.status(400).json({ data: null, error: 'Unit is required' });
      return;
    }

    if (supplierId !== undefined && supplierId && !isValidObjectId(supplierId)) {
      res.status(400).json({ data: null, error: 'Invalid supplierId' });
      return;
    }

    const ingredient = new IngredientModel({
      name: name.trim(),
      unit: unit.trim(),
      costPerUnit: costPerUnit ?? undefined,
      supplierId: supplierId || undefined,
      description: description?.trim(),
    });

    await ingredient.save();

    await recalculateProductsForIngredient(ingredient._id as Types.ObjectId);

    res.status(201).json({ data: ingredient, error: null });
  })
);

router.put(
  '/ingredients/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      res.status(400).json({ data: null, error: 'Invalid ingredient id' });
      return;
    }

    const { name, unit, costPerUnit, supplierId, description } = req.body;

    if (supplierId !== undefined && supplierId && !isValidObjectId(supplierId)) {
      res.status(400).json({ data: null, error: 'Invalid supplierId' });
      return;
    }

    const update: Record<string, unknown> = {};

    if (name !== undefined) {
      if (!name?.trim()) {
        res.status(400).json({ data: null, error: 'Name cannot be empty' });
        return;
      }
      update.name = name.trim();
    }

    if (unit !== undefined) {
      if (!unit?.trim()) {
        res.status(400).json({ data: null, error: 'Unit cannot be empty' });
        return;
      }
      update.unit = unit.trim();
    }

    if (costPerUnit !== undefined) {
      const normalized = Number(costPerUnit);
      if (Number.isNaN(normalized) || normalized < 0) {
        res.status(400).json({ data: null, error: 'costPerUnit must be a positive number' });
        return;
      }
      update.costPerUnit = normalized;
    }

    if (supplierId !== undefined) {
      update.supplierId = supplierId || undefined;
    }

    if (description !== undefined) {
      update.description = description?.trim() || undefined;
    }

    const ingredient = await IngredientModel.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    if (!ingredient) {
      res.status(404).json({ data: null, error: 'Ingredient not found' });
      return;
    }

    await recalculateProductsForIngredient(ingredient._id as Types.ObjectId);

    res.json({ data: ingredient, error: null });
  })
);

router.delete(
  '/ingredients/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      res.status(400).json({ data: null, error: 'Invalid ingredient id' });
      return;
    }

    const ingredient = await IngredientModel.findById(id);

    if (!ingredient) {
      res.status(404).json({ data: null, error: 'Ingredient not found' });
      return;
    }

    await ingredient.deleteOne();

    res.json({ data: { id: ingredient.id }, error: null });
  })
);

export default router;
