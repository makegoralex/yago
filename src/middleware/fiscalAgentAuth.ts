import { NextFunction, Request, Response } from 'express';

import { appConfig } from '../config/env';

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

  if (!trimmed.includes(' ')) {
    return safelyDecodeURIComponent(trimmed);
  }

  return null;
};

export const fiscalAgentAuthMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const configuredToken = appConfig.fiscalAgentToken;

  if (!configuredToken) {
    console.error('Fiscal agent token is not configured. Set FISCAL_AGENT_TOKEN.');
    res.status(500).json({ data: null, error: 'Fiscal agent token is not configured' });
    return;
  }

  const headerToken =
    resolveAuthorizationHeaderToken(req.get('authorization')) ??
    resolveAuthorizationHeaderToken(req.get('Authorization'));

  if (!headerToken || headerToken !== configuredToken) {
    res.status(401).json({ data: null, error: 'Invalid fiscal agent token' });
    return;
  }

  next();
};
