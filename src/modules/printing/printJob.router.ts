import crypto from 'crypto';
import express from 'express';
import { isValidObjectId } from 'mongoose';

import { appConfig } from '../../config/env';
import { PrintJobModel } from './printJob.model';

const router = express.Router();

const safeEqual = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
};

const printTokenMiddleware: express.RequestHandler = (req, res, next) => {
  const configuredToken = appConfig.printJobToken;

  if (!configuredToken) {
    res.status(500).json({ message: 'Print job token is not configured' });
    return;
  }

  const providedToken = req.header('X-Print-Token');
  if (!providedToken) {
    res.status(401).json({ message: 'Missing print job token' });
    return;
  }

  if (!safeEqual(providedToken, configuredToken)) {
    res.status(403).json({ message: 'Invalid print job token' });
    return;
  }

  next();
};

router.use(printTokenMiddleware);

router.get('/next', async (req, res, next) => {
  try {
    const registerId = req.query.registerId;
    if (typeof registerId !== 'string' || !registerId.trim()) {
      res.status(400).json({ message: 'registerId query param is required' });
      return;
    }

    const job = await PrintJobModel.findOneAndUpdate(
      { registerId, status: 'pending' },
      { status: 'processing', processingStartedAt: new Date() },
      { sort: { createdAt: 1 }, new: true }
    ).lean();

    if (!job) {
      res.status(404).json({ message: 'No pending print jobs' });
      return;
    }

    res.json(job);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/ack', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400).json({ message: 'Invalid print job id' });
      return;
    }

    const status = req.body?.status;
    if (status !== 'printed' && status !== 'failed') {
      res.status(400).json({ message: 'status must be printed or failed' });
      return;
    }

    const updateOps: Record<string, Record<string, unknown>> = {
      $set: {
        status,
        completedAt: new Date(),
      },
    };

    if (status === 'failed') {
      const errorMessage = typeof req.body?.errorMessage === 'string' ? req.body.errorMessage : undefined;
      if (errorMessage) {
        updateOps.$set.errorMessage = errorMessage;
      }
    } else {
      updateOps.$unset = { errorMessage: '' };
    }

    const job = await PrintJobModel.findByIdAndUpdate(id, updateOps, { new: true }).lean();

    if (!job) {
      res.status(404).json({ message: 'Print job not found' });
      return;
    }

    res.json(job);
  } catch (error) {
    next(error);
  }
});

export default router;
