import { Document, Schema, model } from 'mongoose';

export interface AppSettingsDocument extends Document {
  billingEnabled: boolean;
}

const appSettingsSchema = new Schema<AppSettingsDocument>(
  {
    billingEnabled: {
      type: Boolean,
      default: false,
      required: true,
    },
  },
  { timestamps: true }
);

export const AppSettingsModel = model<AppSettingsDocument>('AppSettings', appSettingsSchema);
