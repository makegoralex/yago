import { CashierPortalSnapshot } from './cashierPortal.types';

export interface CashierPortalPlan {
  version: string;
  notes: string[];
  supportedFeatures: Array<'schedule' | 'payroll' | 'training'>;
}

const PLAN_VERSION = '2024-Q3-draft';

export const getCashierPortalPlan = (): CashierPortalPlan => ({
  version: PLAN_VERSION,
  notes: [
    'Личные кабинеты кассиров должны предоставлять доступ к сменам, графику и оплате труда.',
    'Планируется интеграция с учетной системой зарплаты и модулем обучения.',
    'Необходим REST/GraphQL API для мобильного клиента кассира.',
  ],
  supportedFeatures: ['schedule', 'payroll', 'training'],
});

export const buildCashierPortalSnapshot = async (
  cashierId: string
): Promise<CashierPortalSnapshot> => {
  // TODO: Реализовать после выбора хранилища расписания и зарплатных данных
  return {
    cashierId,
    schedule: [],
    hourlyRates: [],
    trainings: [],
  };
};
