import { z } from 'zod';

import type { UserRole } from '../models/User';
import { objectIdSchema, nonEmptyString } from './common';

const roleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.enum(['cashier', 'owner'] as const));

export const authSchemas = {
  register: z.object({
    name: nonEmptyString,
    email: z.string().email(),
    password: z.string().min(6, 'Password must be at least 6 characters long'),
    role: roleSchema.optional().transform((role) => role as UserRole),
    organizationId: objectIdSchema.optional(),
  }),
  login: z.object({
    email: z.string().email(),
    password: z.string().min(1, 'Password is required'),
    organizationId: objectIdSchema.optional(),
  }),
  refresh: z.object({
    refreshToken: nonEmptyString,
  }),
};

export type RegisterBody = z.infer<typeof authSchemas.register>;
export type LoginBody = z.infer<typeof authSchemas.login>;
export type RefreshBody = z.infer<typeof authSchemas.refresh>;
