import mongoose from 'mongoose';

import app from './app';
import { appConfig, validateConfig } from './config/env';
import { ensureDefaultOwnerExists } from './startup/createAdmin';
import { ensureDemoCatalogSeeded } from './startup/seedCatalog';
import { migrateUserIndexes } from './startup/migrateUserIndexes';

const startServer = async (): Promise<void> => {
  try {
    validateConfig();

    await mongoose.connect(appConfig.mongoUri);
    console.log('Connected to MongoDB');

    await migrateUserIndexes();

    await ensureDefaultOwnerExists();
    await ensureDemoCatalogSeeded();

    app.listen(appConfig.port, '0.0.0.0', () => {
      console.log(`Server is running on port ${appConfig.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

void startServer();
