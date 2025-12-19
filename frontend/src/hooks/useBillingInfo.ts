import { useCallback, useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';

import api from '../lib/api';
import { useAuthStore } from '../store/auth';

export type BillingInfo = {
  plan: string;
  status: string;
  trialEndsAt?: string | null;
  nextPaymentDueAt?: string | null;
  monthlyPrice: number;
  isPaymentDue?: boolean;
  daysUntilNextPayment?: number | null;
  daysLeftInTrial?: number | null;
};

const normalizeErrorMessage = (error: unknown, fallback: string): string => {
  if (isAxiosError(error)) {
    return error.response?.data?.error ?? error.message ?? fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
};

export const useBillingInfo = () => {
  const user = useAuthStore((state) => state.user);
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [billingEnabled, setBillingEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refreshBilling = useCallback(async () => {
    if (!user?.organizationId) {
      setBilling(null);
      setBillingEnabled(false);
      return null;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.get(`/api/organizations/${user.organizationId}`);
      const billingInfo = (response.data?.data?.billing ?? null) as BillingInfo | null;
      const enabled = Boolean(response.data?.data?.billingEnabled);
      setBilling(billingInfo);
      setBillingEnabled(enabled);
      return billingInfo;
    } catch (err) {
      const message = normalizeErrorMessage(err, 'Не удалось загрузить информацию о подписке');
      setError(message);
      setBilling(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user?.organizationId]);

  useEffect(() => {
    void refreshBilling();
  }, [refreshBilling]);

  const billingLocked = useMemo(
    () => billingEnabled && ['expired', 'paused'].includes(billing?.status?.toLowerCase() ?? ''),
    [billing, billingEnabled]
  );

  return { billing, billingEnabled, billingLocked, refreshBilling, loading, error } as const;
};
