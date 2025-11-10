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
}

const buildTokenPayload = (user: IUser): TokenPayload => ({
  sub: user.id,
  email: user.email,
  role: user.role,
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
  role?: UserRole;
}): Promise<{ user: IUser; tokens: AuthTokens }> => {
  const existingUser = await UserModel.findOne({ email: params.email.toLowerCase() });

  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  const passwordHash = await hashPassword(params.password);

  const user = await UserModel.create({
    name: params.name,
    email: params.email.toLowerCase(),
    passwordHash,
    role: params.role ?? 'barista',
  });

  const tokens = generateTokens(user);

  return { user, tokens };
};

export const authenticateUser = async (
  email: string,
  password: string
): Promise<{ user: IUser; tokens: AuthTokens }> => {
  const user = await UserModel.findOne({ email: email.toLowerCase() });

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
