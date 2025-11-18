import { Schema, model, type Document } from 'mongoose';

export interface IRestaurantSettings extends Document {
  singletonKey: string;
  name: string;
  logoUrl?: string;
  enableOrderTags: boolean;
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
  },
  { timestamps: true }
);

restaurantSettingsSchema.index({ singletonKey: 1 }, { unique: true });

export const RestaurantSettingsModel = model<IRestaurantSettings>('RestaurantSettings', restaurantSettingsSchema);
