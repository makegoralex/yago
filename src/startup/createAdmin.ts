import { hashPassword } from '../services/authService';
import { UserModel } from '../models/User';
import { OrganizationModel } from '../models/Organization';

const DEFAULT_OWNER_EMAIL = 'owner@yago.coffee';
const DEFAULT_OWNER_PASSWORD = 'owner123';
const DEFAULT_ORGANIZATION_NAME = 'Yago Coffee';

export const ensureDefaultOwnerExists = async (): Promise<void> => {
  const existingAdmin = await UserModel.findOne({ email: DEFAULT_OWNER_EMAIL });

  if (existingAdmin) {
    if (!existingAdmin.organizationId) {
      const existingOrganization =
        (await OrganizationModel.findOne({ ownerUserId: existingAdmin._id })) ??
        (await OrganizationModel.findOne({ name: DEFAULT_ORGANIZATION_NAME }));

      const organization =
        existingOrganization ??
        (await OrganizationModel.create({
          name: DEFAULT_ORGANIZATION_NAME,
          ownerUserId: existingAdmin._id,
          subscriptionPlan: 'trial',
          subscriptionStatus: 'trial',
        }));

      if (!organization.ownerUserId) {
        organization.ownerUserId = existingAdmin._id;
      }

      if (!existingAdmin.organizationId) {
        existingAdmin.organizationId = organization._id;
      }

      await Promise.all([existingAdmin.save(), organization.save()]);
    }

    return;
  }

  const passwordHash = await hashPassword(DEFAULT_OWNER_PASSWORD);

  const organization =
    (await OrganizationModel.findOne({ name: DEFAULT_ORGANIZATION_NAME })) ??
    (await OrganizationModel.create({
      name: DEFAULT_ORGANIZATION_NAME,
      subscriptionPlan: 'trial',
      subscriptionStatus: 'trial',
    }));

  const owner = await UserModel.create({
    name: 'Yago Owner',
    email: DEFAULT_OWNER_EMAIL,
    passwordHash,
    role: 'owner',
    organizationId: organization._id,
  });

  organization.ownerUserId = organization.ownerUserId ?? owner._id;
  await organization.save();

  console.log('Default owner user created: owner@yago.coffee / owner123');
};
