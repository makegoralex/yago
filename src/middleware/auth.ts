import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { appConfig } from '../config/env';
import { UserModel } from '../models/User';

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  organizationId?: string;
}

const TOKEN_COOKIE_NAMES = ['accessToken', 'token'];

const parseCookieHeader = (cookieHeader: string | undefined): Record<string, string> => {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(';').reduce<Record<string, string>>((acc, segment) => {
    const [rawName, ...rest] = segment.split('=');
    if (!rawName) {
      return acc;
    }

    const name = rawName.trim();
    const value = rest.join('=').trim();
    if (!name) {
      return acc;
    }

    acc[name] = value;
    return acc;
  }, {});
};

const safelyDecodeURIComponent = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const resolveAuthorizationHeaderToken = (headerValue: string | undefined): string | null => {
  if (!headerValue) {
    return null;
  }

  const trimmed = headerValue.trim();
  if (!trimmed) {
    return null;
  }

  const bearerMatch = /^Bearer\s+(.+)$/i.exec(trimmed);
  if (bearerMatch?.[1]) {
    const candidate = bearerMatch[1].trim();
    return candidate ? safelyDecodeURIComponent(candidate) : null;
  }

  const tokenMatch = /^Token\s+(.+)$/i.exec(trimmed);
  if (tokenMatch?.[1]) {
    const candidate = tokenMatch[1].trim();
    return candidate ? safelyDecodeURIComponent(candidate) : null;
  }

  if (!trimmed.includes(' ')) {
    return safelyDecodeURIComponent(trimmed);
  }

  return null;
};

const resolveAccessToken = (req: Request): string | null => {
  const headerToken =
    resolveAuthorizationHeaderToken(req.get('authorization')) ??
    resolveAuthorizationHeaderToken(req.get('Authorization'));
  if (headerToken) {
    return headerToken;
  }

  const directHeaderToken =
    (typeof req.headers['x-access-token'] === 'string'
      ? req.headers['x-access-token']
      : Array.isArray(req.headers['x-access-token'])
        ? req.headers['x-access-token'][0]
        : undefined) ??
    (typeof req.headers['access-token'] === 'string'
      ? req.headers['access-token']
      : Array.isArray(req.headers['access-token'])
        ? req.headers['access-token'][0]
        : undefined);

  if (directHeaderToken) {
    return safelyDecodeURIComponent(directHeaderToken);
  }

  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = parseCookieHeader(cookieHeader);
    for (const name of TOKEN_COOKIE_NAMES) {
      if (cookies[name]) {
        return safelyDecodeURIComponent(cookies[name]);
      }
    }
  }

  const queryToken = req.query.accessToken ?? req.query.token;
  if (typeof queryToken === 'string' && queryToken.trim()) {
    return safelyDecodeURIComponent(queryToken.trim());
  }

  return null;
};

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = resolveAccessToken(req);

    if (!token) {
      res.status(401).json({ data: null, error: 'Authorization token is required' });
      return;
    }

    const payload = jwt.verify(token, appConfig.jwtAccessSecret) as TokenPayload;

    const user = await UserModel.findById(payload.sub).select('name email role organizationId');

    if (!user) {
      res.status(401).json({ data: null, error: 'User not found' });
      return;
    }

    req.user = {
      id: typeof user.id === 'string' && user.id ? user.id : String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId ? String(user.organizationId) : undefined,
    };

    if (req.user.organizationId) {
      req.organization = { id: req.user.organizationId };
    }

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ data: null, error: 'Invalid or expired token' });
  }
};

export const requireRole = (roles: string | string[]) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role;

    if (!userRole) {
      res.status(403).json({ data: null, error: 'Forbidden' });
      return;
    }

    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({ data: null, error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};
