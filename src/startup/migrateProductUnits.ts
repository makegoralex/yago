import { ProductModel } from '../modules/catalog/catalog.model';

export const migrateProductUnits = async (): Promise<void> => {
  await ProductModel.updateMany(
    { $or: [{ unit: { $exists: false } }, { unit: null }, { unit: '' }] },
    { $set: { unit: 'шт' } }
  );
};
