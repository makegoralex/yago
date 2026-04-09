import { lazy } from 'react';

export const POSLazyPaymentModal = lazy(() => import('./PaymentModal'));
export const POSLazyLoyaltyModal = lazy(() => import('./LoyaltyModal'));
export const POSLazyRedeemPointsModal = lazy(() => import('./RedeemPointsModal'));
export const POSLazyModifierModal = lazy(() => import('./ModifierModal'));
