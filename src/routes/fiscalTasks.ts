import { Router, type Request, type RequestHandler, type Response } from 'express';

import { fiscalAgentAuthMiddleware } from '../middleware/fiscalAgentAuth';
import { FiscalTaskError, createFiscalTask, fetchNextFiscalTask, updateFiscalTaskStatus } from '../modules/fiscalTasks/fiscalTask.service';

const router = Router();

const asyncHandler = (handler: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

const handleError = (res: Response, error: unknown): void => {
  if (error instanceof FiscalTaskError) {
    res.status(error.status).json({ data: null, error: error.message });
    return;
  }

  console.error('Unexpected fiscal task error', error);
  res.status(500).json({ data: null, error: 'Internal server error' });
};

router.use(fiscalAgentAuthMiddleware);

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const task = await createFiscalTask({
        organizationId: req.body?.organizationId,
        fiscalDeviceId: req.body?.fiscalDeviceId,
        type: req.body?.type,
        payload: req.body?.payload,
      });

      res.status(201).json({ data: { task }, error: null });
    } catch (error) {
      handleError(res, error);
    }
  })
);

router.get(
  '/next',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const task = await fetchNextFiscalTask({
        organizationId: req.query.organizationId,
        fiscalDeviceId: req.query.fiscalDeviceId,
      });

      res.json({ data: { task }, error: null });
    } catch (error) {
      handleError(res, error);
    }
  })
);

router.post(
  '/:id/status',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const task = await updateFiscalTaskStatus({
        id,
        status: req.body?.status,
        fnCode: req.body?.fnCode,
        error: req.body?.error,
      });

      res.json({ data: { task }, error: null });
    } catch (error) {
      handleError(res, error);
    }
  })
);

export default router;
