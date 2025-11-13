import { FilterQuery } from 'mongoose';

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

export class CashierServiceError extends Error {
  constructor(message: string, public readonly status: number = 400) {
    super(message);
    this.name = 'CashierServiceError';
  }
}

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

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

export const listCashiers = async (
  filter: FilterQuery<IUser> = {}
): Promise<CashierSummary[]> => {
  const query: FilterQuery<IUser> = { ...filter, role: 'cashier' };

  const cashiers = (await UserModel.find(query).sort({ name: 1 }).lean()) as Array<
    IUser & { _id: { toString(): string } }
  >;

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
