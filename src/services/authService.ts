import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { appConfig } from '../config/env';
import { IUser, UserModel, UserRole } from '../models/User';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  organizationId?: string;
}

const resolveUserId = (user: IUser): string => {
  const maybeId = (user as { id?: string }).id;
  if (typeof maybeId === 'string' && maybeId) {
    return maybeId;
  }

  const maybeObjectId = (user as { _id?: unknown })._id;
  if (maybeObjectId) {
    return String(maybeObjectId);
  }

  throw new Error('Unable to resolve user identifier');
};

const buildTokenPayload = (user: IUser): TokenPayload => ({
  sub: resolveUserId(user),
  email: user.email,
  role: user.role,
  organizationId: user.organizationId ? String(user.organizationId) : undefined,
});

export const generateTokens = (user: IUser): AuthTokens => {
  const payload = buildTokenPayload(user);

  const accessToken = jwt.sign(payload, appConfig.jwtAccessSecret, {
    expiresIn: '15m',
  });

  const refreshToken = jwt.sign(payload, appConfig.jwtRefreshSecret, {
    expiresIn: '7d',
  });

  return { accessToken, refreshToken };
};

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, appConfig.bcryptSaltRounds);
};

export const comparePasswords = async (
  candidate: string,
  hashed: string
): Promise<boolean> => {
  return bcrypt.compare(candidate, hashed);
};

export const registerUser = async (params: {
  name: string;
  email: string;
  password: string;
  organizationId?: string;
  role?: UserRole;
}): Promise<{ user: IUser; tokens: AuthTokens }> => {
  if (!params.organizationId && params.role !== 'superAdmin') {
    throw new Error('organizationId is required');
  }

  const existingUser = await UserModel.findOne({
    email: params.email.toLowerCase(),
    organizationId: params.organizationId,
  });

  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  const passwordHash = await hashPassword(params.password);

  const user = await UserModel.create({
    name: params.name,
    email: params.email.toLowerCase(),
    passwordHash,
    organizationId: params.organizationId,
    role: params.role ?? 'cashier',
  });

  const tokens = generateTokens(user);

  return { user, tokens };
};

export const authenticateUser = async (
  email: string,
  password: string,
  organizationId?: string
): Promise<{ user: IUser; tokens: AuthTokens }> => {
  const normalizedEmail = email.toLowerCase();
  let user: IUser | null = null;

  if (organizationId) {
    user = await UserModel.findOne({ email: normalizedEmail, organizationId });
  } else {
    const users = await UserModel.find({ email: normalizedEmail });

    if (users.length > 1) {
      throw new Error('organizationId is required for this account');
    }

    user = users[0] ?? null;
  }

  if (!user) {
    throw new Error('Invalid credentials');
  }

  const passwordMatches = await comparePasswords(password, user.passwordHash);

  if (!passwordMatches) {
    throw new Error('Invalid credentials');
  }

  const tokens = generateTokens(user);

  return { user, tokens };
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, appConfig.jwtRefreshSecret) as TokenPayload;
};
