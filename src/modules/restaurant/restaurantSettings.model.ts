import { Schema, model, type Document } from 'mongoose';

export interface IRestaurantSettings extends Document {
  singletonKey: string;
  name: string;
  logoUrl?: string;
  enableOrderTags: boolean;
  measurementUnits: string[];
  loyaltyRate: number;
  createdAt: Date;
  updatedAt: Date;
}

const restaurantSettingsSchema = new Schema<IRestaurantSettings>(
  {
    singletonKey: {
      type: String,
      default: 'singleton',
      unique: true,
      required: true,
      immutable: true,
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
  },
  { timestamps: true }
);

restaurantSettingsSchema.index({ singletonKey: 1 }, { unique: true });

export const RestaurantSettingsModel = model<IRestaurantSettings>('RestaurantSettings', restaurantSettingsSchema);
