import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { appConfig } from '../config/env';
import { UserModel } from '../models/User';

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ data: null, error: 'Authorization header missing or invalid' });
      return;
    }

    const token = authHeader.slice(7);
    const payload = jwt.verify(token, appConfig.jwtAccessSecret) as TokenPayload;

    const user = await UserModel.findById(payload.sub).select('name email role');

    if (!user) {
      res.status(401).json({ data: null, error: 'User not found' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

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
