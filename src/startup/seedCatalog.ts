import { Types } from 'mongoose';

import { CategoryModel, ProductModel, type ProductIngredient } from '../modules/catalog/catalog.model';
import { IngredientModel } from '../modules/catalog/ingredient.model';
import { SupplierModel } from '../modules/suppliers/supplier.model';
import { WarehouseModel } from '../modules/inventory/warehouse.model';
import { InventoryItemModel, type InventoryItem } from '../modules/inventory/inventoryItem.model';

const demoCatalog = [
  {
    name: 'Эспрессо-бар',
    sortOrder: 1,
    products: [
      {
        name: 'Эспрессо',
        basePrice: 160,
        discountType: 'percentage' as const,
        discountValue: 6,
        ingredients: [
          { ref: 'Кофе арабика', quantity: 18 },
          { ref: 'Вода фильтрованная', quantity: 40 },
        ],
      },
      {
        name: 'Американо',
        basePrice: 190,
        ingredients: [
          { ref: 'Кофе арабика', quantity: 18 },
          { ref: 'Вода фильтрованная', quantity: 120 },
        ],
      },
    ],
  },
  {
    name: 'Молочные напитки',
    sortOrder: 2,
    products: [
      {
        name: 'Капучино',
        basePrice: 240,
        ingredients: [
          { ref: 'Кофе арабика', quantity: 18 },
          { ref: 'Молоко 3.2%', quantity: 180 },
        ],
      },
      {
        name: 'Латте',
        basePrice: 250,
        ingredients: [
          { ref: 'Кофе арабика', quantity: 18 },
          { ref: 'Молоко 3.2%', quantity: 220 },
        ],
      },
    ],
  },
  {
    name: 'Авторские',
    sortOrder: 3,
    products: [
      {
        name: 'Флэт Уайт',
        basePrice: 270,
        ingredients: [
          { ref: 'Кофе арабика', quantity: 20 },
          { ref: 'Молоко 3.2%', quantity: 180 },
        ],
      },
      {
        name: 'Матча латте',
        basePrice: 280,
        ingredients: [
          { ref: 'Матча порошок', quantity: 3 },
          { ref: 'Молоко 3.2%', quantity: 220 },
        ],
      },
    ],
  },
];

const demoSuppliers = [
  {
    name: 'Yago Beans',
    contactName: 'Александр',
    phone: '+7 999 111-22-33',
  },
  {
    name: 'Fresh Milk Co',
    contactName: 'Мария',
    phone: '+7 999 444-55-66',
  },
  {
    name: 'Tea Import',
    contactName: 'Игорь',
    phone: '+7 999 777-88-99',
  },
];

const demoIngredients = [
  {
    name: 'Кофе арабика',
    unit: 'грамм',
    costPerUnit: 0.75,
    supplier: 'Yago Beans',
  },
  {
    name: 'Молоко 3.2%',
    unit: 'миллилитр',
    costPerUnit: 0.09,
    supplier: 'Fresh Milk Co',
  },
  {
    name: 'Вода фильтрованная',
    unit: 'миллилитр',
    costPerUnit: 0.01,
  },
  {
    name: 'Матча порошок',
    unit: 'грамм',
    costPerUnit: 3.5,
    supplier: 'Tea Import',
  },
];

const demoWarehouses = [
  {
    name: 'Главный склад',
    location: 'Москва, ул. Кофейная, 12',
  },
  {
    name: 'Центр города',
    location: 'Москва, Тверская 5',
  },
];

export const ensureDemoCatalogSeeded = async (): Promise<void> => {
  const [categoryCount, productCount, ingredientCount, supplierCount, warehouseCount] = await Promise.all([
    CategoryModel.countDocuments(),
    ProductModel.countDocuments(),
    IngredientModel.countDocuments(),
    SupplierModel.countDocuments(),
    WarehouseModel.countDocuments(),
  ]);

  if (supplierCount === 0) {
    await SupplierModel.insertMany(demoSuppliers);
  }

  const suppliers = (await SupplierModel.find().lean()) as Array<{
    _id: Types.ObjectId;
    name: string;
  }>;
  const supplierMap = new Map<string, Types.ObjectId>();
  for (const supplier of suppliers) {
    supplierMap.set(supplier.name, supplier._id as Types.ObjectId);
  }

  if (ingredientCount === 0) {
    await IngredientModel.insertMany(
      demoIngredients.map((ingredient) => ({
        name: ingredient.name,
        unit: ingredient.unit,
        costPerUnit: ingredient.costPerUnit,
        supplierId: ingredient.supplier ? supplierMap.get(ingredient.supplier) : undefined,
      }))
    );
  }

  const ingredients = (await IngredientModel.find().lean()) as Array<{
    _id: Types.ObjectId;
    name: string;
  }>;
  const ingredientMap = new Map<string, Types.ObjectId>();
  for (const ingredient of ingredients) {
    ingredientMap.set(ingredient.name, ingredient._id as Types.ObjectId);
  }

  if (categoryCount === 0 && productCount === 0) {
    const createdCategories = (await CategoryModel.insertMany(
      demoCatalog.map(({ name, sortOrder }) => ({ name, sortOrder }))
    )) as Array<{ _id: Types.ObjectId; name: string }>;

    const categoryIdMap = new Map<string, Types.ObjectId>();
    for (const category of createdCategories) {
      categoryIdMap.set(category.name, category._id as Types.ObjectId);
    }

    const productsToInsert = demoCatalog.flatMap(({ name, products }) => {
      const categoryId = categoryIdMap.get(name);
      if (!categoryId) {
        return [];
      }

      return products.map((product) => {
        const ingredientsList: ProductIngredient[] | undefined = product.ingredients
          ?.map((ingredient) => {
            const ingredientId = ingredientMap.get(ingredient.ref);
            if (!ingredientId) {
              return null;
            }
            return { ingredientId, quantity: ingredient.quantity };
          })
          .filter((item): item is ProductIngredient => Boolean(item));

        const basePrice = product.basePrice;
        const discountType = product.discountType;
        const discountValue = product.discountValue;
        let finalPrice = basePrice;
        if (discountType === 'percentage' && discountValue) {
          finalPrice = basePrice * (1 - discountValue / 100);
        }

        return {
          name: product.name,
          categoryId,
          basePrice,
          price: Number(finalPrice.toFixed(2)),
          discountType,
          discountValue,
          ingredients: ingredientsList,
        };
      });
    });

    if (productsToInsert.length > 0) {
      await ProductModel.insertMany(productsToInsert);
    }

    console.log('Seeded demo catalog for Yago POS');
  }

  if (warehouseCount === 0) {
    const warehouses = (await WarehouseModel.insertMany(
      demoWarehouses
    )) as Array<{ _id: Types.ObjectId }>;

    const firstWarehouse = warehouses[0];
    if (!firstWarehouse) {
      return;
    }
    const espressoBeans = ingredientMap.get('Кофе арабика');
    const milk = ingredientMap.get('Молоко 3.2%');
    const matcha = ingredientMap.get('Матча порошок');

    const inventorySeed: Array<Pick<InventoryItem, 'warehouseId' | 'itemType' | 'itemId' | 'quantity' | 'unitCost'>> = [];

    if (espressoBeans) {
      inventorySeed.push({
        warehouseId: firstWarehouse._id as Types.ObjectId,
        itemType: 'ingredient',
        itemId: espressoBeans,
        quantity: 5000,
        unitCost: 0.75,
      });
    }

    if (milk) {
      inventorySeed.push({
        warehouseId: firstWarehouse._id as Types.ObjectId,
        itemType: 'ingredient',
        itemId: milk,
        quantity: 8000,
        unitCost: 0.09,
      });
    }

    if (matcha) {
      inventorySeed.push({
        warehouseId: firstWarehouse._id as Types.ObjectId,
        itemType: 'ingredient',
        itemId: matcha,
        quantity: 1200,
        unitCost: 3.5,
      });
    }

    if (inventorySeed.length > 0) {
      await InventoryItemModel.insertMany(inventorySeed);
    }
  }
};
