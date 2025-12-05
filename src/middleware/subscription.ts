import { NextFunction, Request, Response } from 'express';

import { OrganizationModel } from '../models/Organization';

const isReadOnlyMethod = (method: string): boolean => ['GET', 'HEAD', 'OPTIONS'].includes(method);

const resolveOrganizationId = (req: Request): string | null => {
  const organizationId = req.organization?.id ?? req.user?.organizationId;

  if (!organizationId) {
    return null;
  }

  return organizationId;
};

export const enforceActiveSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user?.role === 'superAdmin' || isReadOnlyMethod(req.method)) {
      next();
      return;
    }

    const organizationId = resolveOrganizationId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const organization = await OrganizationModel.findById(organizationId).select('subscriptionStatus').lean();

    if (!organization) {
      res.status(404).json({ data: null, error: 'Organization not found' });
      return;
    }

    if (['expired', 'paused'].includes(organization.subscriptionStatus ?? '')) {
      res.status(402).json({
        data: null,
        error: 'Подписка неактивна. Продлите её, чтобы продолжить редактирование данных.',
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};
