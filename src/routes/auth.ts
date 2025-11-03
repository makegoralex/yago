import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { UserModel, UserRole } from '../models/User';
import bcrypt from 'bcryptjs';
import {
  generateTokens,
  verifyRefreshToken,
} from '../services/authService';

export const authRouter = Router();

/**
 * REGISTER
 */
authRouter.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body ?? {};

    const allowedRoles: UserRole[] = ['admin', 'manager', 'barista'];
    const normalizedRole =
      typeof role === 'string' ? (role.toLowerCase() as UserRole) : 'barista';

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email, and password are required' });
    }

    if (normalizedRole && !allowedRoles.includes(normalizedRole)) {
      return res.status(400).json({ message: 'Invalid role value' });
    }

    const existing = await UserModel.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await UserModel.create({
      name,
      email,
      passwordHash,
      role: normalizedRole,
    });

    const tokens = generateTokens(user);

    res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      tokens,
    });
  } catch (error) {
    console.error('Register error:', error);
    const message = error instanceof Error ? error.message : 'Registration failed';
    const status = message.includes('exists') ? 409 : 400;
    res.status(status).json({ message });
  }
});

/**
 * LOGIN
 */
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }

    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // ВАЖНО: сверяем с user.passwordHash
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const tokens = generateTokens(user);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      tokens,
    });
  } catch (error) {
    console.error('Login error:', error);
    const message = error instanceof Error ? error.message : 'Authentication failed';
    res.status(401).json({ message });
  }
});

/**
 * REFRESH TOKEN
 */
authRouter.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body ?? {};

    if (!refreshToken) {
      return res.status(400).json({ message: 'refreshToken is required' });
    }

    const payload = verifyRefreshToken(refreshToken);
    const user = await UserModel.findById(payload.sub);

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const tokens = generateTokens(user);

    res.json({ tokens });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid refresh token';
    res.status(401).json({ message: message || 'Invalid refresh token' });
  }
});

/**
 * CURRENT USER
 */
authRouter.get('/me', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  res.json({ user: req.user });
});
