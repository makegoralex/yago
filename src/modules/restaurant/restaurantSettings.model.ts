import { Schema, Types, model, type Document } from 'mongoose';

export interface IRestaurantSettings extends Document {
  name: string;
  logoUrl?: string;
  enableOrderTags: boolean;
  measurementUnits: string[];
  loyaltyRate: number;
  loyaltyRedeemAllCategories: boolean;
  loyaltyRedeemCategoryIds: string[];
  singletonKey: string;
  organizationId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const restaurantSettingsSchema = new Schema<IRestaurantSettings>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    singletonKey: {
      type: String,
      required: true,
      unique: false,
      default: 'singleton',
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      default: 'Yago Coffee',
    },
    logoUrl: {
      type: String,
      default: '',
      trim: true,
    },
    enableOrderTags: {
      type: Boolean,
      default: false,
    },
    measurementUnits: {
      type: [String],
      default: ['гр', 'кг', 'мл', 'л', 'шт'],
    },
    loyaltyRate: {
      type: Number,
      default: 5,
      min: 0,
      max: 100,
    },
    loyaltyRedeemAllCategories: {
      type: Boolean,
      default: true,
    },
    loyaltyRedeemCategoryIds: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

restaurantSettingsSchema.index({ organizationId: 1 }, { unique: true, sparse: true });

export const RestaurantSettingsModel = model<IRestaurantSettings>('RestaurantSettings', restaurantSettingsSchema);
