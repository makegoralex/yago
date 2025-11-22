import React, { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/Login';
import POSPage from './pages/POS';
import AdminPage from './pages/Admin';
import SettingsPage from './pages/Settings';
import LandingPage from './pages/Landing';
import SuperAdminPage from './pages/SuperAdmin';
import ProtectedRoute from './components/layout/ProtectedRoute';
import { type AuthUser, type UserRole, useAuthStore } from './store/auth';
import MobileNav from './components/ui/MobileNav';
import { useRestaurantStore } from './store/restaurant';

const OWNER_ROLES: UserRole[] = ['owner'];

const getLandingRoute = (user: AuthUser | null): string => {
  if (!user) {
    return '/';
  }

  if (user.role === 'superAdmin') {
    return '/super-admin';
  }

  return OWNER_ROLES.includes(user.role) ? '/admin' : '/pos';
};

const App: React.FC = () => {
  const { user } = useAuthStore();
  const fetchBranding = useRestaurantStore((state) => state.fetchBranding);

  useEffect(() => {
    if (!user) {
      return;
    }

    fetchBranding().catch((error) => console.error('Failed to sync restaurant branding', error));
  }, [fetchBranding, user]);

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute allowed={['cashier', 'owner']} />}>
          <Route path="/pos" element={<POSPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route element={<ProtectedRoute allowed={['owner']} />}>
          <Route path="/admin" element={<AdminPage />} />
        </Route>
        <Route element={<ProtectedRoute allowed={['superAdmin']} />}>
          <Route path="/super-admin" element={<SuperAdminPage />} />
        </Route>
        <Route path="/" element={user ? <Navigate to={getLandingRoute(user)} replace /> : <LandingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <MobileNav />
    </>
  );
};

export default App;
