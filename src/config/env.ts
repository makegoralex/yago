import dotenv from 'dotenv';

dotenv.config();

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const appConfig = {
  port: parseNumber(process.env.PORT, 3000),
  mongoUri: process.env.MONGO_URI ?? '',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? '',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
  bcryptSaltRounds: parseNumber(process.env.BCRYPT_SALT_ROUNDS, 10),
};

export const validateConfig = (): void => {
  if (!appConfig.mongoUri) {
    throw new Error('MONGO_URI environment variable is required');
  }

  if (!appConfig.jwtAccessSecret) {
    throw new Error('JWT_ACCESS_SECRET environment variable is required');
  }

  if (!appConfig.jwtRefreshSecret) {
    throw new Error('JWT_REFRESH_SECRET environment variable is required');
  }
};
