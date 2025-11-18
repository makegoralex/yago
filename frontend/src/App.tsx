import React, { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/Login';
import POSPage from './pages/POS';
import AdminPage from './pages/Admin';
import SettingsPage from './pages/Settings';
import ProtectedRoute from './components/layout/ProtectedRoute';
import { useAuthStore } from './store/auth';
import MobileNav from './components/ui/MobileNav';
import { useRestaurantStore } from './store/restaurant';

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
        <Route element={<ProtectedRoute />}>
          <Route path="/pos" element={<POSPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route element={<ProtectedRoute allowed={['admin']} />}>
          <Route path="/admin" element={<AdminPage />} />
        </Route>
        <Route path="/" element={<Navigate to={user ? '/pos' : '/login'} replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <MobileNav />
    </>
  );
};

export default App;
