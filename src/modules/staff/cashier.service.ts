import { FilterQuery, Types } from 'mongoose';

import { IUser, UserModel } from '../../models/User';
import { hashPassword } from '../../services/authService';

export interface CashierSummary {
  id: string;
  name: string;
  email: string;
  role: IUser['role'];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCashierParams {
  name: string;
  email: string;
  password: string;
}

export interface UpdateCashierParams {
  id: string;
  name?: string;
  email?: string;
  password?: string;
  role?: IUser['role'];
}

export class CashierServiceError extends Error {
  constructor(message: string, public readonly status: number = 400) {
    super(message);
    this.name = 'CashierServiceError';
  }
}

const normalizeEmail = (email: string): string => email.trim().toLowerCase();
const STAFF_ROLES: IUser['role'][] = ['cashier', 'barista'];

const ensureValidId = (id: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(id)) {
    throw new CashierServiceError('Некорректный идентификатор кассира');
  }

  return new Types.ObjectId(id);
};

const resolveId = (user: IUser): string => {
  const maybeId = (user as { id?: string }).id;
  if (typeof maybeId === 'string' && maybeId) {
    return maybeId;
  }

  const maybeObjectId = (user as { _id?: unknown })._id;
  if (maybeObjectId) {
    return String(maybeObjectId);
  }

  throw new CashierServiceError('Не удалось определить идентификатор пользователя');
};

const sanitizeUser = (user: IUser): CashierSummary => ({
  id: resolveId(user),
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

type LeanCashier = {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role: IUser['role'];
  createdAt: Date;
  updatedAt: Date;
};

export const listCashiers = async (
  filter: FilterQuery<IUser> = {}
): Promise<CashierSummary[]> => {
  const roleFilter: FilterQuery<IUser> = { role: { $in: STAFF_ROLES } };
  const query: FilterQuery<IUser> = { ...filter, ...roleFilter };

  const cashiers = (await UserModel.find(query).sort({ name: 1 }).lean().exec()) as unknown as LeanCashier[];

  return cashiers.map((cashier) => ({
    id: cashier._id.toString(),
    name: cashier.name,
    email: cashier.email,
    role: cashier.role,
    createdAt: cashier.createdAt,
    updatedAt: cashier.updatedAt,
  }));
};

export const createCashierAccount = async (
  params: CreateCashierParams
): Promise<CashierSummary> => {
  const trimmedName = params.name.trim();
  const normalizedEmail = normalizeEmail(params.email);
  const password = params.password.trim();

  if (!trimmedName) {
    throw new CashierServiceError('Имя кассира обязательно');
  }

  if (!normalizedEmail) {
    throw new CashierServiceError('Email кассира обязателен');
  }

  if (!password) {
    throw new CashierServiceError('Пароль кассира обязателен');
  }

  const existingUser = await UserModel.findOne({ email: normalizedEmail });

  if (existingUser) {
    throw new CashierServiceError('Пользователь с таким email уже существует', 409);
  }

  const passwordHash = await hashPassword(password);

  const user = await UserModel.create({
    name: trimmedName,
    email: normalizedEmail,
    passwordHash,
    role: 'cashier',
  });

  return sanitizeUser(user);
};

const findCashierById = async (id: string) => {
  const objectId = ensureValidId(id);
  const cashier = await UserModel.findOne({ _id: objectId, role: { $in: STAFF_ROLES } });

  if (!cashier) {
    throw new CashierServiceError('Кассир не найден', 404);
  }

  return cashier;
};

export const updateCashierAccount = async (
  params: UpdateCashierParams
): Promise<CashierSummary> => {
  const cashier = await findCashierById(params.id);

  if (params.name !== undefined) {
    const trimmedName = params.name.trim();
    if (!trimmedName) {
      throw new CashierServiceError('Имя кассира обязательно');
    }
    cashier.name = trimmedName;
  }

  if (params.email !== undefined) {
    const normalizedEmail = normalizeEmail(params.email);
    if (!normalizedEmail) {
      throw new CashierServiceError('Email кассира обязателен');
    }

    const existingUser = await UserModel.findOne({
      email: normalizedEmail,
      _id: { $ne: cashier._id },
    });

    if (existingUser) {
      throw new CashierServiceError('Пользователь с таким email уже существует', 409);
    }

    cashier.email = normalizedEmail;
  }

  if (params.password !== undefined) {
    const trimmedPassword = params.password.trim();
    if (!trimmedPassword) {
      throw new CashierServiceError('Пароль кассира обязателен');
    }

    cashier.passwordHash = await hashPassword(trimmedPassword);
  }

  if (params.role !== undefined) {
    if (!STAFF_ROLES.includes(params.role)) {
      throw new CashierServiceError('Некорректная роль сотрудника');
    }

    cashier.role = params.role;
  }

  await cashier.save();
  return sanitizeUser(cashier);
};

export const deleteCashierAccount = async (id: string): Promise<void> => {
  const cashier = await findCashierById(id);
  await UserModel.deleteOne({ _id: cashier._id });
};
