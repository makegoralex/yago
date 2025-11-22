import { isValidObjectId, Types } from 'mongoose';

import { CustomerModel, type CustomerDocument } from '../customers/customer.model';
import { getLoyaltyAccrualRate } from '../restaurant/restaurantSettings.service';

const roundTwoDecimals = (value: number): number => Number(value.toFixed(2));

export const earnLoyaltyPoints = async (
  customerId: string,
  amount: number
): Promise<{ customer: CustomerDocument; pointsEarned: number }> => {
  if (!isValidObjectId(customerId)) {
    throw new Error('Invalid customerId');
  }

  if (typeof amount !== 'number' || Number.isNaN(amount) || amount <= 0) {
    throw new Error('amount must be a positive number');
  }

  const customer = await CustomerModel.findById(customerId);

  if (!customer) {
    throw new Error('Customer not found');
  }

  const organizationId = customer.organizationId as Types.ObjectId | undefined;

  if (!organizationId) {
    throw new Error('Organization context is required');
  }

  const normalizedAmount = roundTwoDecimals(amount);
  if (normalizedAmount <= 0) {
    throw new Error('amount must be a positive number');
  }

  const loyaltyRate = await getLoyaltyAccrualRate(organizationId);
  const pointsEarned = roundTwoDecimals((normalizedAmount * loyaltyRate) / 100);

  if (pointsEarned <= 0) {
    throw new Error('Calculated points must be greater than zero');
  }

  customer.points = roundTwoDecimals(customer.points + pointsEarned);
  customer.totalSpent = roundTwoDecimals(customer.totalSpent + normalizedAmount);

  await customer.save();

  return { customer, pointsEarned };
};

export const redeemLoyaltyPoints = async (
  customerId: string,
  points: number
): Promise<CustomerDocument> => {
  if (!isValidObjectId(customerId)) {
    throw new Error('Invalid customerId');
  }

  if (typeof points !== 'number' || Number.isNaN(points) || points <= 0) {
    throw new Error('points must be a positive number');
  }

  const normalizedPoints = roundTwoDecimals(points);

  const customer = await CustomerModel.findById(customerId);

  if (!customer) {
    throw new Error('Customer not found');
  }

  if (customer.points < normalizedPoints) {
    throw new Error('Insufficient loyalty points');
  }

  customer.points = roundTwoDecimals(customer.points - normalizedPoints);

  await customer.save();

  return customer;
};
