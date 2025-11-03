import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import swaggerUi from 'swagger-ui-express';

dotenv.config();

const app = express();

const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Yago POS API',
    version: '0.1.0',
    description: 'API documentation for the Yago POS system backend.',
  },
  paths: {
    '/healthz': {
      get: {
        summary: 'Health check',
        responses: {
          '200': {
            description: 'API is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'string',
                      example: 'ok',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

app.get('/healthz', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.get('/', (_req: Request, res: Response) => {
  res.send('✅ Yago POS API is running');
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

async function connectToDatabase(): Promise<void> {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    console.warn('MONGO_URI is not set. Skipping MongoDB connection.');
    return;
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
  }
}

const port = Number(process.env.PORT) || 3000;

connectToDatabase()
  .catch((error) => {
    console.error('Unexpected error during MongoDB initialization:', error);
  })
  .finally(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`Server is running on port ${port}`);
    });
  });
