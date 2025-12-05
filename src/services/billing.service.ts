import { Types } from 'mongoose';
import { OrganizationDocument, OrganizationModel, SubscriptionStatus } from '../models/Organization';
import { SubscriptionPlanModel } from '../models/SubscriptionPlan';

const ONE_DAY_MS = 1000 * 60 * 60 * 24;
export const TRIAL_PERIOD_DAYS = 14;
export const DEFAULT_BILLING_CYCLE_DAYS = 30;
export const DEFAULT_PAID_PLAN_PRICE = 4900;

export type BillingInfo = {
  plan: OrganizationDocument['subscriptionPlan'];
  status: SubscriptionStatus;
  trialEndsAt?: Date;
  trialStartedAt?: Date;
  daysLeftInTrial?: number;
  daysUsedInTrial?: number;
  nextPaymentDueAt?: Date;
  daysUntilNextPayment?: number;
  monthlyPrice: number;
  isPaymentDue: boolean;
};

export type LeanOrganization = Pick<
  OrganizationDocument,
  '_id' | 'createdAt' | 'updatedAt' | 'subscriptionPlan' | 'subscriptionStatus' | 'trialEndsAt' | 'nextPaymentDueAt'
> & { _id: Types.ObjectId };

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * ONE_DAY_MS);

const calculateDiffInDays = (from: Date, to: Date) => Math.max(0, Math.ceil((to.getTime() - from.getTime()) / ONE_DAY_MS));

const resolveTrialEndDate = (organization: LeanOrganization) =>
  organization.trialEndsAt ?? addDays(organization.createdAt, TRIAL_PERIOD_DAYS);

const resolveNextPaymentDate = (organization: LeanOrganization) => {
  if (organization.subscriptionPlan !== 'paid') {
    return undefined;
  }

  return (
    organization.nextPaymentDueAt ??
    addDays(organization.trialEndsAt ?? organization.updatedAt ?? organization.createdAt, DEFAULT_BILLING_CYCLE_DAYS)
  );
};

export const loadPlanPricing = async (planNames: (OrganizationDocument['subscriptionPlan'] | undefined)[]) => {
  const names = [...new Set(planNames.filter(Boolean) as string[])];
  const plans = names.length
    ? await SubscriptionPlanModel.find({ name: { $in: names } }).select('name price').lean()
    : [];

  return plans.reduce<Map<string, number>>((acc, plan) => {
    acc.set(plan.name, typeof plan.price === 'number' ? plan.price : DEFAULT_PAID_PLAN_PRICE);
    return acc;
  }, new Map());
};

export const resolvePlanPrice = (
  plan: OrganizationDocument['subscriptionPlan'],
  pricing: Map<string, number>
): number => {
  if (!plan) return 0;
  if (pricing.has(plan)) return pricing.get(plan) ?? 0;
  if (plan === 'paid') return DEFAULT_PAID_PLAN_PRICE;
  return 0;
};

export const buildBillingInfo = (
  organization: LeanOrganization,
  pricing: Map<string, number>
): BillingInfo => {
  const now = new Date();
  const trialEndsAt = resolveTrialEndDate(organization);
  const trialStartedAt = organization.createdAt;
  const daysLeftInTrial = organization.subscriptionPlan === 'trial' ? calculateDiffInDays(now, trialEndsAt) : undefined;
  const daysUsedInTrial = organization.subscriptionPlan === 'trial' ? calculateDiffInDays(trialStartedAt, now) : undefined;
  const isTrialExpired = organization.subscriptionPlan === 'trial' && daysLeftInTrial === 0 && now >= trialEndsAt;
  const nextPaymentDueAt = resolveNextPaymentDate(organization);
  const isPaymentDue = Boolean(nextPaymentDueAt && nextPaymentDueAt.getTime() <= now.getTime());

  let status: SubscriptionStatus = organization.subscriptionStatus;
  if (organization.subscriptionPlan === 'trial') {
    status = isTrialExpired ? 'expired' : 'trial';
  }

  if (organization.subscriptionPlan === 'paid') {
    if (isPaymentDue) {
      status = 'paused';
    } else if (status === 'trial' || status === 'expired') {
      status = 'active';
    }
  }

  const daysUntilNextPayment = nextPaymentDueAt ? calculateDiffInDays(now, nextPaymentDueAt) : undefined;
  const monthlyPrice = resolvePlanPrice(organization.subscriptionPlan, pricing);

  return {
    plan: organization.subscriptionPlan,
    status,
    trialEndsAt,
    trialStartedAt,
    daysLeftInTrial,
    daysUsedInTrial,
    nextPaymentDueAt,
    daysUntilNextPayment,
    monthlyPrice,
    isPaymentDue,
  };
};

export const synchronizeOrganizationBilling = async (
  organization: LeanOrganization,
  pricing: Map<string, number>
): Promise<BillingInfo> => {
  const billing = buildBillingInfo(organization, pricing);
  const updates: Record<string, unknown> = {};

  if (!organization.trialEndsAt && billing.trialEndsAt) {
    updates.trialEndsAt = billing.trialEndsAt;
  }

  if (organization.subscriptionStatus !== billing.status) {
    updates.subscriptionStatus = billing.status;
  }

  if (organization.subscriptionPlan === 'paid' && !organization.nextPaymentDueAt && billing.nextPaymentDueAt) {
    updates.nextPaymentDueAt = billing.nextPaymentDueAt;
  }

  if (Object.keys(updates).length > 0) {
    await OrganizationModel.findByIdAndUpdate(organization._id, { $set: updates });
  }

  return billing;
};

export const simulatePaymentCycle = (currentDueDate?: Date) =>
  addDays(currentDueDate ?? new Date(), DEFAULT_BILLING_CYCLE_DAYS);
