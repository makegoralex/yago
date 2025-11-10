import { Schema, model, Document, Types } from 'mongoose';

export interface ProductIngredient {
  ingredientId: Types.ObjectId;
  quantity: number;
}

export interface Category {
  name: string;
  sortOrder?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryDocument extends Document, Category {}

const categorySchema = new Schema<CategoryDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    sortOrder: {
      type: Number,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

export const CategoryModel = model<CategoryDocument>('Category', categorySchema);

export interface Product {
  name: string;
  categoryId: Types.ObjectId;
  description?: string;
  price: number;
  basePrice?: number;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  imageUrl?: string;
  modifiers?: string[];
  ingredients?: ProductIngredient[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductDocument extends Document, Product {}

const productSchema = new Schema<ProductDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    description: {
      type: String,
      required: false,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    basePrice: {
      type: Number,
      required: false,
      min: 0,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: false,
    },
    discountValue: {
      type: Number,
      required: false,
      min: 0,
    },
    imageUrl: {
      type: String,
      required: false,
      trim: true,
    },
    modifiers: {
      type: [String],
      required: false,
      default: undefined,
    },
    ingredients: {
      type: [
        {
          ingredientId: {
            type: Schema.Types.ObjectId,
            ref: 'Ingredient',
            required: true,
          },
          quantity: {
            type: Number,
            required: true,
            min: 0,
          },
        },
      ],
      required: false,
      default: undefined,
    },
    isActive: {
      type: Boolean,
      required: false,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

productSchema.index({ categoryId: 1 });

export const ProductModel = model<ProductDocument>('Product', productSchema);
