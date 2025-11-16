import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import swaggerUi from 'swagger-ui-express';

import { authMiddleware } from './middleware/auth';
import { authRouter } from './routes/auth';
import catalogRouter from './modules/catalog/catalog.router';
import { buildSwaggerDocument } from './swagger';
import orderRouter from './modules/orders/order.router';
import customersRouter from './modules/customers/customer.router';
import loyaltyRouter from './modules/loyalty/loyalty.router';
import reportsRouter from './routes/reports';
import adminManagementRouter from './routes/adminManagement';
import suppliersRouter from './modules/suppliers/supplier.router';
import inventoryRouter from './modules/inventory/inventory.router';
import discountRouter, { createPosDiscountRouter } from './modules/discounts/discount.router';
import { appConfig } from './config/env';
import shiftRouter from './modules/shifts/shift.router';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const posDiscountRouter = createPosDiscountRouter();

app.get('/', (_req, res) => {
  res.send('✅ Yago POS API is running');
});

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/catalog', catalogRouter);
app.use('/api/orders/discounts', posDiscountRouter);
app.use('/api/orders', orderRouter);
app.use('/api/customers', customersRouter);
app.use('/api/loyalty', loyaltyRouter);
app.use('/api/discounts', discountRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/admin', adminManagementRouter);
app.use('/api/shifts', shiftRouter);

app.get('/api/protected', authMiddleware, (req, res) => {
  res.json({
    message: 'Protected resource access granted',
    user: req.user,
  });
});

const swaggerDocument = buildSwaggerDocument();
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const frontendCandidates = [
  appConfig.frontendDistPath,
  path.resolve(__dirname, '..', 'frontend', 'dist'),
  path.resolve(__dirname, '..', 'frontend-dist'),
  path.resolve(__dirname, 'public'),
].filter(Boolean) as string[];

const resolveExistingBundle = (candidates: string[]): string | undefined => {
  for (const candidate of candidates) {
    try {
      const stats = fs.statSync(candidate);
      if (!stats.isDirectory()) {
        continue;
      }

      const htmlPath = path.join(candidate, 'index.html');
      if (fs.existsSync(htmlPath)) {
        return candidate;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('Failed to inspect frontend bundle path:', candidate, error);
      }
    }
  }

  return undefined;
};

let frontendDistPath = resolveExistingBundle(frontendCandidates);
let frontendStaticMiddleware: express.RequestHandler | null = frontendDistPath
  ? express.static(frontendDistPath)
  : null;

const refreshFrontendBundle = (): void => {
  const maybeBundle = resolveExistingBundle(frontendCandidates);
  if (!maybeBundle) {
    if (frontendDistPath) {
      console.warn(
        'Frontend bundle became unavailable. Requests to /pos or /admin will return 404 until the bundle is rebuilt.'
      );
    }

    frontendDistPath = undefined;
    frontendStaticMiddleware = null;
    return;
  }

  if (maybeBundle !== frontendDistPath || !frontendStaticMiddleware) {
    frontendDistPath = maybeBundle;
    frontendStaticMiddleware = express.static(frontendDistPath);
  }
};

const serveFrontendStatic: express.RequestHandler = (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/docs') || req.path.startsWith('/healthz')) {
    return next();
  }

  if (!frontendStaticMiddleware) {
    refreshFrontendBundle();
  }

  if (!frontendStaticMiddleware) {
    return next();
  }

  return frontendStaticMiddleware(req, res, (err) => {
    if (err) {
      return next(err);
    }

    return next();
  });
};

const serveSpaFallback = (req: Request, res: Response, next: NextFunction): void => {
  if (req.path.startsWith('/api/')) {
    return next();
  }

  if (req.path.startsWith('/docs') || req.path.startsWith('/healthz')) {
    return next();
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    next();
    return;
  }

  let distPath = frontendDistPath;
  if (!distPath || !fs.existsSync(path.join(distPath, 'index.html'))) {
    refreshFrontendBundle();
    distPath = frontendDistPath;
  }

  if (!distPath) {
    next();
    return;
  }

  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        frontendDistPath = undefined;
        frontendStaticMiddleware = null;
      }

      next(err);
      return;
    }
  });
};

if (!frontendDistPath) {
  console.warn(
    'PWA bundle was not found. Build the frontend (npm run build inside frontend/) and copy the dist folder next to the API or provide FRONTEND_DIST_PATH.'
  );
}

app.use(serveFrontendStatic);
app.use(serveSpaFallback);

const frontendPath = path.join(__dirname, 'frontend');
app.use(express.static(frontendPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

export default app;
