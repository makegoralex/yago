import { type Request, type Response, type NextFunction, type RequestHandler } from 'express';

const EVOTOR_HEADER_PREFIX = 'x-evotor-';
const SAFE_DEBUG_HEADERS = [
  'authorization',
  'x-yago-app-token',
  'x-access-token',
  'access-token',
  'x-device-id',
  'x-device-uuid',
  'x-real-ip',
  'x-forwarded-for',
  'x-forwarded-proto',
  'x-forwarded-host',
  'via',
  'cf-connecting-ip',
] as const;

const maskSecret = (value: string): string => {
  if (!value) {
    return value;
  }

  if (value.length <= 10) {
    return `${value.slice(0, 2)}***`;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

const normalizeHeaderValue = (value: string | string[] | undefined): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && value[0]) {
    return value[0];
  }

  return undefined;
};

const sanitizeHeaderValue = (headerName: string, headerValue: string): string => {
  if (headerName === 'authorization') {
    const [scheme, token] = headerValue.split(/\s+/, 2);
    if (!token) {
      return maskSecret(headerValue);
    }

    return `${scheme} ${maskSecret(token)}`;
  }

  if (headerName.endsWith('token')) {
    return maskSecret(headerValue);
  }

  return headerValue;
};

export const evotorRequestDebug = (label: string): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const interestingHeaders: Record<string, string> = {};

    for (const [headerName, rawHeaderValue] of Object.entries(req.headers)) {
      const normalizedName = headerName.toLowerCase();
      const value = normalizeHeaderValue(rawHeaderValue);
      if (!value) {
        continue;
      }

      const shouldLog =
        normalizedName.startsWith(EVOTOR_HEADER_PREFIX) ||
        SAFE_DEBUG_HEADERS.includes(normalizedName as (typeof SAFE_DEBUG_HEADERS)[number]);

      if (!shouldLog) {
        continue;
      }

      interestingHeaders[normalizedName] = sanitizeHeaderValue(normalizedName, value);
    }

    console.info('[evotor-debug]', {
      endpoint: label,
      method: req.method,
      originalUrl: req.originalUrl,
      requestId: req.get('x-request-id') ?? null,
      source: {
        ip: req.ip,
        forwardedFor: req.get('x-forwarded-for') ?? null,
        forwardedProto: req.get('x-forwarded-proto') ?? null,
        realIp: req.get('x-real-ip') ?? null,
        via: req.get('via') ?? null,
      },
      headers: interestingHeaders,
    });

    next();
  };
};

