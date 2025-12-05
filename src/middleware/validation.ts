import type { RequestHandler } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';

type ValidationSchemas = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
};

const formatZodErrors = (error: ZodError) =>
  error.errors.map((issue) => ({
    path: issue.path.join('.') || undefined,
    message: issue.message,
  }));

export const validateRequest = (schemas: ValidationSchemas): RequestHandler => {
  return (req, res, next) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body ?? {});
      }

      if (schemas.query) {
        req.query = schemas.query.parse(req.query ?? {});
      }

      if (schemas.params) {
        req.params = schemas.params.parse(req.params ?? {});
      }
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          data: null,
          error: {
            message: 'Validation failed',
            details: formatZodErrors(error),
          },
        });
        return;
      }

      next(error);
      return;
    }

    next();
  };
};

export type InferBody<T extends ValidationSchemas> = T['body'] extends ZodTypeAny
  ? ReturnType<T['body']['parse']>
  : unknown;
