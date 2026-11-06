import { Router, type Request, type Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { OrganizationModel } from '../models/Organization';
import { UserModel } from '../models/User';
import {
  authenticateUser,
  generateTokens,
  registerUser,
  verifyRefreshToken,
} from '../services/authService';
import { validateRequest } from '../middleware/validation';
import { authSchemas, type LoginBody, type RefreshBody, type RegisterBody } from '../validation/authSchemas';
import { evotorRequestDebug } from '../middleware/evotorRequestDebug';
import { AuthenticationError, isInvalidTokenError } from '../services/authErrors';

export const authRouter = Router();

const resolveUserId = (user: { id?: string; _id?: unknown } | { id?: string } | { _id?: unknown }): string => {
  const maybeId = (user as { id?: string }).id;
  if (typeof maybeId === 'string' && maybeId) {
    return maybeId;
  }

  const maybeObjectId = (user as { _id?: unknown })._id;
  if (maybeObjectId) {
    return String(maybeObjectId);
  }

  throw new Error('User identifier is not available');
};

const resolveOrganizationName = async (organizationId?: string): Promise<string | undefined> => {
  if (!organizationId) {
    return undefined;
  }

  const organization = await OrganizationModel.findById(organizationId).select('name').lean();
  return organization?.name;
};

authRouter.post('/register', validateRequest({ body: authSchemas.register }), async (req: Request, res: Response) => {
  try {
    const { name, email, password, role, organizationId } = req.body as RegisterBody;

    const { user, tokens } = await registerUser({
      name,
      email,
      password,
      organizationId,
      role,
    });

    const resolvedOrganizationId = user.organizationId ? String(user.organizationId) : undefined;
    const organizationName = await resolveOrganizationName(resolvedOrganizationId);

    res.status(201).json({
      data: {
        user: {
          id: resolveUserId(user),
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: resolvedOrganizationId,
          organizationName,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    const status = message.includes('exists') ? 409 : 400;
    res.status(status).json({ data: null, error: message });
  }
});

authRouter.post('/login', evotorRequestDebug('POST /api/auth/login'), validateRequest({ body: authSchemas.login }), async (req: Request, res: Response) => {
  try {
    const { email, password, organizationId } = req.body as LoginBody;

    const { user, tokens } = await authenticateUser(email, password, organizationId);

    const resolvedOrganizationId = user.organizationId ? String(user.organizationId) : undefined;
    const organizationName = await resolveOrganizationName(resolvedOrganizationId);

    res.json({
      data: {
        user: {
          id: resolveUserId(user),
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: resolvedOrganizationId,
          organizationName,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
      error: null,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      res.status(401).json({ data: null, error: error.message });
      return;
    }
    console.error('[auth-login] temporarily unavailable', error);
    res.status(503).json({ data: null, error: 'Authentication temporarily unavailable' });
  }
});

authRouter.post('/refresh', evotorRequestDebug('POST /api/auth/refresh'), validateRequest({ body: authSchemas.refresh }), async (req: Request, res: Response) => {
  const startedAt = Date.now();
  const rawUserAgent = String(req.headers['user-agent'] ?? 'unknown');
  const userAgent = rawUserAgent.slice(0, 180);

  try {
    const { refreshToken } = req.body as RefreshBody;

    const payload = verifyRefreshToken(refreshToken);
    const user = await UserModel.findById(payload.sub);

    if (!user) {
      res.status(401).json({ data: null, error: 'User not found' });
      return;
    }

    const tokens = generateTokens(user);

    res.json({
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
      error: null,
    });
    console.info('[auth-refresh]', {
      status: 200,
      latencyMs: Date.now() - startedAt,
      userAgent,
    });
  } catch (error) {
    const invalidToken = isInvalidTokenError(error);
    const status = invalidToken ? 401 : 503;
    const message = invalidToken ? 'Invalid refresh token' : 'Authentication temporarily unavailable';
    res.status(status).json({ data: null, error: message });
    console.warn('[auth-refresh]', {
      status,
      latencyMs: Date.now() - startedAt,
      userAgent,
      error: error instanceof Error ? error.message : message,
    });
  }
});

authRouter.get('/me', authMiddleware, async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ data: null, error: 'Unauthorized' });
    return;
  }

  res.json({ data: req.user, error: null });
});
