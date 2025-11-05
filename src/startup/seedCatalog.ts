import { Types } from 'mongoose';

import { CategoryModel, ProductModel } from '../modules/catalog/catalog.model';

const demoCatalog = [
  {
    name: 'Эспрессо-бар',
    sortOrder: 1,
    products: [
      { name: 'Эспрессо', price: 150 },
      { name: 'Американо', price: 180 },
    ],
  },
  {
    name: 'Молочные напитки',
    sortOrder: 2,
    products: [
      { name: 'Капучино', price: 220 },
      { name: 'Латте', price: 230 },
    ],
  },
  {
    name: 'Авторские',
    sortOrder: 3,
    products: [
      { name: 'Флэт Уайт', price: 250 },
      { name: 'Матча латте', price: 260 },
    ],
  },
];

export const ensureDemoCatalogSeeded = async (): Promise<void> => {
  const categoryCount = await CategoryModel.countDocuments();
  const productCount = await ProductModel.countDocuments();

  if (categoryCount > 0 || productCount > 0) {
    return;
  }

  const createdCategories = await CategoryModel.insertMany(
    demoCatalog.map(({ name, sortOrder }) => ({ name, sortOrder }))
  );

  const categoryIdMap = new Map<string, Types.ObjectId>();
  createdCategories.forEach((category) => {
    categoryIdMap.set(category.name, category._id as Types.ObjectId);
  });

  const productsToInsert = demoCatalog.flatMap(({ name, products }) => {
    const categoryId = categoryIdMap.get(name);
    if (!categoryId) {
      return [];
    }

    return products.map((product) => ({
      name: product.name,
      price: product.price,
      categoryId,
    }));
  });

  if (productsToInsert.length > 0) {
    await ProductModel.insertMany(
      productsToInsert.map(({ name, price, categoryId }) => ({ name, price, categoryId }))
    );
  }

  console.log('Seeded demo catalog for Yago POS');
};
