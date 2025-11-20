import { Router, type Request, type Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { UserModel, UserRole } from '../models/User';
import {
  authenticateUser,
  generateTokens,
  registerUser,
  verifyRefreshToken,
} from '../services/authService';

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

authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password, role, organizationId } = req.body ?? {};

    const allowedRoles: UserRole[] = ['admin', 'manager', 'cashier', 'barista'];
    const normalizedRole =
      typeof role === 'string' ? (role.toLowerCase() as UserRole) : undefined;

    if (!name || !email || !password) {
      res.status(400).json({ data: null, error: 'name, email, and password are required' });
      return;
    }

    if (normalizedRole && !allowedRoles.includes(normalizedRole)) {
      res.status(400).json({ data: null, error: 'Invalid role value' });
      return;
    }

    const { user, tokens } = await registerUser({
      name,
      email,
      password,
      organizationId,
      role: normalizedRole,
    });

    res.status(201).json({
      data: {
        user: {
          id: resolveUserId(user),
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId ? String(user.organizationId) : undefined,
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

authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password, organizationId } = req.body ?? {};

    if (!email || !password) {
      res.status(400).json({ data: null, error: 'email and password are required' });
      return;
    }

    const { user, tokens } = await authenticateUser(email, password, organizationId);

    res.json({
      data: {
        user: {
          id: resolveUserId(user),
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId ? String(user.organizationId) : undefined,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    res.status(401).json({ data: null, error: message });
  }
});

authRouter.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body ?? {};

    if (!refreshToken) {
      res.status(400).json({ data: null, error: 'refreshToken is required' });
      return;
    }

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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid refresh token';
    res.status(401).json({ data: null, error: message || 'Invalid refresh token' });
  }
});

authRouter.get('/me', authMiddleware, async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ data: null, error: 'Unauthorized' });
    return;
  }

  res.json({ data: req.user, error: null });
});
