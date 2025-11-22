import { Router, type NextFunction, type Request, type Response } from 'express';
import { isValidObjectId, Types } from 'mongoose';

import { requireRole, authMiddleware } from '../../middleware/auth';
import { CategoryModel, ProductModel } from '../catalog/catalog.model';
import { DiscountModel, type Discount } from './discount.model';
import { getAvailableDiscounts } from './discount.service';

const router = Router();

const ADMIN_ROLES = ['owner', 'superAdmin'];
const CASHIER_ROLES = ['cashier', 'owner', 'superAdmin'];

const getOrganizationObjectId = (req: Request): Types.ObjectId | null => {
  const organizationId = req.organization?.id;

  if (!organizationId || !isValidObjectId(organizationId)) {
    return null;
  }

  return new Types.ObjectId(organizationId);
};

type DiscountPayload = {
  name?: unknown;
  description?: unknown;
  type?: unknown;
  scope?: unknown;
  value?: unknown;
  categoryId?: unknown;
  productId?: unknown;
  autoApply?: unknown;
  autoApplyDays?: unknown;
  autoApplyStart?: unknown;
  autoApplyEnd?: unknown;
  isActive?: unknown;
};

const normalizeString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') {
      return true;
    }

    if (value.toLowerCase() === 'false') {
      return false;
    }
  }

  return fallback;
};

const parseNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) {
    return undefined;
  }

  return numberValue;
};

const parseDays = (value: unknown): number[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isInteger(entry) && entry >= 0 && entry <= 6);

  return normalized.length ? Array.from(new Set(normalized)) : undefined;
};

const ensureCategoryExists = async (
  categoryId: Types.ObjectId,
  organizationId: Types.ObjectId
): Promise<void> => {
  const exists = await CategoryModel.exists({ _id: categoryId, organizationId });
  if (!exists) {
    throw new Error('Категория не найдена');
  }
};

const ensureProductExists = async (
  productId: Types.ObjectId,
  organizationId: Types.ObjectId
): Promise<void> => {
  const exists = await ProductModel.exists({ _id: productId, organizationId });
  if (!exists) {
    throw new Error('Товар не найден');
  }
};

const parseTime = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!/^\d{2}:\d{2}$/.test(trimmed)) {
    return undefined;
  }

  const [hours, minutes] = trimmed.split(':');
  const h = Number(hours);
  const m = Number(minutes);

  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return undefined;
  }

  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
};

const toStringId = (value: unknown): string | undefined => {
  if (!value) {
    return undefined;
  }

  if (value instanceof Types.ObjectId) {
    return value.toString();
  }

  if (typeof value === 'object' && value !== null && '_id' in value) {
    const nestedId = (value as { _id?: unknown })._id;
    if (nestedId instanceof Types.ObjectId) {
      return nestedId.toString();
    }
    if (typeof nestedId === 'string') {
      return nestedId;
    }
  }

  if (typeof value === 'string') {
    return value;
  }

  return undefined;
};

type DiscountRecord = Discount & { _id: Types.ObjectId };

const toValidStringId = (value: unknown): string | undefined => {
  const stringId = toStringId(value);
  if (!stringId) {
    return undefined;
  }

  return Types.ObjectId.isValid(stringId) ? stringId : undefined;
};

const mapDiscountResponse = async (
  discounts: DiscountRecord[],
  organizationId: Types.ObjectId
) => {
  const categoryIds = new Set<string>();
  const productIds = new Set<string>();

  for (const discount of discounts) {
    const categoryId = toValidStringId(discount.categoryId);
    const productId = toValidStringId(discount.productId);
    if (categoryId) {
      categoryIds.add(categoryId);
    }
    if (productId) {
      productIds.add(productId);
    }
  }

  const categories = categoryIds.size
    ? await CategoryModel.find({
        _id: { $in: Array.from(categoryIds, (id) => new Types.ObjectId(id)) },
        organizationId,
      })
        .select('name')
        .lean()
    : [];
  const products = productIds.size
    ? await ProductModel.find({
        _id: { $in: Array.from(productIds, (id) => new Types.ObjectId(id)) },
        organizationId,
      })
        .select('name')
        .lean()
    : [];

  const categoryMap = new Map<string, string>();
  for (const category of categories) {
    categoryMap.set(category._id.toString(), category.name ?? '');
  }

  const productMap = new Map<string, string>();
  for (const product of products) {
    productMap.set(product._id.toString(), product.name ?? '');
  }

  return discounts.map((discount) => {
    const categoryId = toValidStringId(discount.categoryId);
    const productId = toValidStringId(discount.productId);
    const discountId = toValidStringId(discount._id) ?? discount._id.toString();

    return {
      _id: discountId,
      name: discount.name,
      description: discount.description,
      type: discount.type,
      scope: discount.scope,
      value: discount.value,
      categoryId,
      productId,
      targetName:
        discount.scope === 'category'
          ? categoryId
            ? categoryMap.get(categoryId)
            : undefined
          : discount.scope === 'product'
          ? productId
            ? productMap.get(productId)
            : undefined
          : undefined,
      autoApply: Boolean(discount.autoApply),
      autoApplyDays: discount.autoApplyDays,
      autoApplyStart: discount.autoApplyStart,
      autoApplyEnd: discount.autoApplyEnd,
      isActive: Boolean(discount.isActive),
      createdAt: discount.createdAt,
      updatedAt: discount.updatedAt,
    };
  });
};

export const withErrorHandling = (
  handler: (req: RouterRequest, res: RouterResponse) => Promise<void>
) => {
  return async (req: RouterRequest, res: RouterResponse, next: NextFunction) => {
    try {
      await handler(req, res);
    } catch (error) {
      next(error);
    }
  };
};

type RouterRequest = Request;
type RouterResponse = Response;

export const handleGetAvailableDiscounts = async (
  req: RouterRequest,
  res: RouterResponse
): Promise<void> => {
  const organizationId = getOrganizationObjectId(req);

  if (!organizationId) {
    res.status(403).json({ data: null, error: 'Organization context is required' });
    return;
  }

  const discounts = await getAvailableDiscounts(organizationId);
  const mapped = await mapDiscountResponse(discounts, organizationId);
  res.json({ data: mapped, error: null });
};

export const handleListDiscounts = async (
  req: RouterRequest,
  res: RouterResponse
): Promise<void> => {
  const organizationId = getOrganizationObjectId(req);

  if (!organizationId) {
    res.status(403).json({ data: null, error: 'Organization context is required' });
    return;
  }

  const discounts = (await DiscountModel.find({ organizationId })
    .sort({ createdAt: -1 })
    .lean()
    .exec()) as unknown as DiscountRecord[];
  const mapped = await mapDiscountResponse(discounts, organizationId);
  res.json({ data: mapped, error: null });
};

const parseDiscountPayload = async (
  payload: DiscountPayload,
  organizationId: Types.ObjectId,
  partial = false
) => {
  const name = normalizeString(payload.name);
  const description = normalizeString(payload.description);
  const type = payload.type === 'percentage' || payload.type === 'fixed' ? payload.type : undefined;
  const scope = payload.scope === 'order' || payload.scope === 'category' || payload.scope === 'product' ? payload.scope : undefined;
  const value = parseNumber(payload.value);
  const autoApply =
    payload.autoApply === undefined && partial ? undefined : parseBoolean(payload.autoApply, false);
  const autoApplyDays = parseDays(payload.autoApplyDays);
  const autoApplyStart = parseTime(payload.autoApplyStart);
  const autoApplyEnd = parseTime(payload.autoApplyEnd);
  let isActive: boolean | undefined;
  if (payload.isActive === undefined && partial) {
    isActive = undefined;
  } else if (typeof payload.isActive === 'boolean') {
    isActive = payload.isActive;
  } else {
    isActive = parseBoolean(payload.isActive, true);
  }

  let categoryId: Types.ObjectId | undefined;
  if (payload.categoryId) {
    if (typeof payload.categoryId !== 'string' || !isValidObjectId(payload.categoryId)) {
      throw new Error('Некорректный идентификатор категории');
    }
    categoryId = new Types.ObjectId(payload.categoryId);
    await ensureCategoryExists(categoryId, organizationId);
  }

  let productId: Types.ObjectId | undefined;
  if (payload.productId) {
    if (typeof payload.productId !== 'string' || !isValidObjectId(payload.productId)) {
      throw new Error('Некорректный идентификатор товара');
    }
    productId = new Types.ObjectId(payload.productId);
    await ensureProductExists(productId, organizationId);
  }

  if (!partial) {
    if (!name) {
      throw new Error('Укажите название скидки');
    }
    if (!type) {
      throw new Error('Укажите тип скидки');
    }
    if (!scope) {
      throw new Error('Укажите область применения скидки');
    }
    if (value === undefined || value < 0) {
      throw new Error('Укажите значение скидки');
    }
  }

  if (type === 'percentage' && value !== undefined && (value < 0 || value > 100)) {
    throw new Error('Процентная скидка должна быть в диапазоне 0-100');
  }

  if (type === 'fixed' && value !== undefined && value < 0) {
    throw new Error('Скидка должна быть положительным числом');
  }

  if (!partial) {
    if (scope === 'category' && !categoryId) {
      throw new Error('Укажите категорию для скидки по категории');
    }

    if (scope === 'product' && !productId) {
      throw new Error('Укажите товар для скидки на товар');
    }
  }

  if (autoApply && (scope === 'order' || scope === 'product')) {
    throw new Error('Автоприменение доступно только для скидок на категории');
  }

  if (autoApply && (!autoApplyStart || !autoApplyEnd)) {
    throw new Error('Для автоприменения укажите время начала и окончания');
  }

  return {
    name,
    description,
    type,
    scope,
    value,
    categoryId,
    productId,
    autoApply,
    autoApplyDays,
    autoApplyStart,
    autoApplyEnd,
    isActive,
  };
};

type ParsedDiscountPayload = Awaited<ReturnType<typeof parseDiscountPayload>>;

const buildDiscountUpdate = (parsed: ParsedDiscountPayload): Record<string, unknown> => {
  const update: Record<string, unknown> = {};

  if (parsed.name !== undefined) update.name = parsed.name;
  if (parsed.description !== undefined) update.description = parsed.description;
  if (parsed.type !== undefined) update.type = parsed.type;
  if (parsed.scope !== undefined) update.scope = parsed.scope;
  if (parsed.value !== undefined) update.value = parsed.value;
  if (parsed.categoryId !== undefined) update.categoryId = parsed.categoryId;
  if (parsed.productId !== undefined) update.productId = parsed.productId;
  if (parsed.autoApply !== undefined) update.autoApply = parsed.autoApply;
  if (parsed.autoApplyDays !== undefined) update.autoApplyDays = parsed.autoApplyDays;
  if (parsed.autoApplyStart !== undefined) update.autoApplyStart = parsed.autoApplyStart;
  if (parsed.autoApplyEnd !== undefined) update.autoApplyEnd = parsed.autoApplyEnd;
  if (parsed.isActive !== undefined) update.isActive = parsed.isActive;

  if (parsed.autoApply === false) {
    update.autoApplyDays = undefined;
    update.autoApplyStart = undefined;
    update.autoApplyEnd = undefined;
  }

  return update;
};

export const handleCreateDiscount = async (
  req: RouterRequest,
  res: RouterResponse
): Promise<void> => {
  const organizationId = getOrganizationObjectId(req);

  if (!organizationId) {
    res.status(403).json({ data: null, error: 'Organization context is required' });
    return;
  }

  const parsed = await parseDiscountPayload(req.body ?? {}, organizationId, false);
  const created = await DiscountModel.create({
    name: parsed.name!,
    description: parsed.description,
    type: parsed.type!,
    scope: parsed.scope!,
    value: parsed.value!,
    categoryId: parsed.categoryId,
    productId: parsed.productId,
    autoApply: parsed.autoApply,
    autoApplyDays: parsed.autoApply ? parsed.autoApplyDays : undefined,
    autoApplyStart: parsed.autoApply ? parsed.autoApplyStart : undefined,
    autoApplyEnd: parsed.autoApply ? parsed.autoApplyEnd : undefined,
    isActive: parsed.isActive,
    organizationId,
  });

  const discount = (await DiscountModel.findById(created._id).lean()) as DiscountRecord | null;
  if (!discount) {
    throw new Error('Не удалось загрузить созданную скидку');
  }

  const mapped = await mapDiscountResponse([discount], organizationId);
  res.status(201).json({ data: mapped[0], error: null });
};

export const handleUpdateDiscount = async (
  req: RouterRequest,
  res: RouterResponse
): Promise<void> => {
  const { id } = req.params;
  const organizationId = getOrganizationObjectId(req);
  if (!isValidObjectId(id)) {
    res.status(400).json({ data: null, error: 'Некорректный идентификатор скидки' });
    return;
  }

  if (!organizationId) {
    res.status(403).json({ data: null, error: 'Organization context is required' });
    return;
  }

  const parsed = await parseDiscountPayload(req.body ?? {}, organizationId, true);
  const update = buildDiscountUpdate(parsed);

  const discount = (await DiscountModel.findOneAndUpdate({ _id: id, organizationId }, update, { new: true }).lean()) as
    | DiscountRecord
    | null;
  if (!discount) {
    res.status(404).json({ data: null, error: 'Скидка не найдена' });
    return;
  }

  const mapped = await mapDiscountResponse([discount], organizationId);
  res.json({ data: mapped[0], error: null });
};

export const handleDeleteDiscount = async (
  req: RouterRequest,
  res: RouterResponse
): Promise<void> => {
  const { id } = req.params;
  const organizationId = getOrganizationObjectId(req);
  if (!isValidObjectId(id)) {
    res.status(400).json({ data: null, error: 'Некорректный идентификатор скидки' });
    return;
  }

  if (!organizationId) {
    res.status(403).json({ data: null, error: 'Organization context is required' });
    return;
  }

  const discount = await DiscountModel.findOneAndDelete({ _id: id, organizationId });
  if (!discount) {
    res.status(404).json({ data: null, error: 'Скидка не найдена' });
    return;
  }

  res.json({ data: { deleted: true }, error: null });
};

router.use(authMiddleware);

router.get('/available', requireRole(CASHIER_ROLES), withErrorHandling(handleGetAvailableDiscounts));
router.get('/', requireRole(ADMIN_ROLES), withErrorHandling(handleListDiscounts));
router.post('/', requireRole(ADMIN_ROLES), withErrorHandling(handleCreateDiscount));
router.put('/:id', requireRole(ADMIN_ROLES), withErrorHandling(handleUpdateDiscount));
router.patch('/:id', requireRole(ADMIN_ROLES), withErrorHandling(handleUpdateDiscount));
router.delete('/:id', requireRole(ADMIN_ROLES), withErrorHandling(handleDeleteDiscount));

export const createPosDiscountRouter = (): Router => {
  const posRouter = Router();
  posRouter.use(authMiddleware);
  posRouter.get('/available', requireRole(CASHIER_ROLES), withErrorHandling(handleGetAvailableDiscounts));
  return posRouter;
};

type AdminDiscountRouterOptions = {
  skipAuth?: boolean;
};

export const createAdminDiscountRouter = (options: AdminDiscountRouterOptions = {}): Router => {
  const adminRouter = Router();
  if (!options.skipAuth) {
    adminRouter.use(authMiddleware);
    adminRouter.use(requireRole(ADMIN_ROLES));
  }
  adminRouter.get('/', withErrorHandling(handleListDiscounts));
  adminRouter.post('/', withErrorHandling(handleCreateDiscount));
  adminRouter.put('/:id', withErrorHandling(handleUpdateDiscount));
  adminRouter.patch('/:id', withErrorHandling(handleUpdateDiscount));
  adminRouter.delete('/:id', withErrorHandling(handleDeleteDiscount));
  return adminRouter;
};

export const createDiscountRouters = () => ({
  posRouter: createPosDiscountRouter(),
  adminRouter: createAdminDiscountRouter(),
});

export const __test__ = {
  parseDiscountPayload,
  buildDiscountUpdate,
};

export default router;
