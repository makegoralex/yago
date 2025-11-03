import express, { NextFunction, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';

import { authMiddleware } from './middleware/auth';
import { authRouter } from './routes/auth';
import catalogRouter from './modules/catalog/catalog.router';
import { buildSwaggerDocument } from './swagger';
import orderRouter from './modules/orders/order.router';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (_req, res) => {
  res.send('✅ Yago POS API is running');
});

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/catalog', catalogRouter);
app.use('/api/orders', orderRouter);

app.get('/api/protected', authMiddleware, (req, res) => {
  res.json({
    message: 'Protected resource access granted',
    user: req.user,
  });
});

const swaggerDocument = buildSwaggerDocument();
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

export default app;
