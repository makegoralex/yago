import { UserModel } from '../models/User';

const INDEX_NAME = 'email_1_organizationId_1';
const LEGACY_EMAIL_INDEX = 'email_1';

export const migrateUserIndexes = async (): Promise<void> => {
  const indexes = await UserModel.collection.indexes();

  const hasLegacyEmailIndex = indexes.some((index) => index.name === LEGACY_EMAIL_INDEX);
  if (hasLegacyEmailIndex) {
    await UserModel.collection.dropIndex(LEGACY_EMAIL_INDEX);
  }

  const hasCompositeIndex = indexes.some((index) => index.name === INDEX_NAME);
  if (!hasCompositeIndex) {
    await UserModel.collection.createIndex(
      { email: 1, organizationId: 1 },
      { unique: true, sparse: true, name: INDEX_NAME }
    );
  }
};
