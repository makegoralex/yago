import jwt from 'jsonwebtoken';

export class AuthenticationError extends Error {}

export const isInvalidTokenError = (error: unknown): boolean =>
  error instanceof jwt.JsonWebTokenError || error instanceof jwt.NotBeforeError;
