import { isValidObjectId } from 'mongoose';
import { z } from 'zod';

export const objectIdSchema = z
  .string({ required_error: 'Identifier is required' })
  .trim()
  .refine((value) => isValidObjectId(value), { message: 'Invalid identifier' });

export const nonEmptyString = z
  .string({ required_error: 'Value is required' })
  .trim()
  .min(1, 'Value cannot be empty');

export const optionalBoolean = z.union([z.boolean(), z.undefined()]);
