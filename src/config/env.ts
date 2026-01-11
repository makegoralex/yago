import dotenv from 'dotenv';

dotenv.config();

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const mongoUri = process.env.MONGO_URI ?? process.env.MONGODB_URI ?? '';

export const appConfig = {
  port: parseNumber(process.env.PORT, 3000),
  mongoUri,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? '',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
  bcryptSaltRounds: parseNumber(process.env.BCRYPT_SALT_ROUNDS, 10),
  frontendDistPath: process.env.FRONTEND_DIST_PATH,
  printJobToken: process.env.PRINT_JOB_TOKEN ?? '',
};

export const validateConfig = (): void => {
  if (!appConfig.mongoUri) {
    throw new Error('MongoDB connection string is required (MONGO_URI or MONGODB_URI)');
  }

  if (!appConfig.jwtAccessSecret) {
    throw new Error('JWT_ACCESS_SECRET environment variable is required');
  }

  if (!appConfig.jwtRefreshSecret) {
    throw new Error('JWT_REFRESH_SECRET environment variable is required');
  }
};
