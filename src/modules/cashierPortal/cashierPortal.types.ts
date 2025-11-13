export interface CashierScheduleEntry {
  date: string;
  startTime: string;
  endTime: string;
  locationId: string;
  registerId: string;
  notes?: string;
}

export interface CashierHourlyRate {
  currency: string;
  amount: number;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface CashierTrainingModule {
  id: string;
  title: string;
  description: string;
  status: 'assigned' | 'in_progress' | 'completed';
  assignedAt: string;
  completedAt?: string;
}

export interface CashierPortalSnapshot {
  cashierId: string;
  schedule: CashierScheduleEntry[];
  hourlyRates: CashierHourlyRate[];
  trainings: CashierTrainingModule[];
}
