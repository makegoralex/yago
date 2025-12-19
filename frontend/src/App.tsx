import React, { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import LoginPage from './pages/Login';
import POSPage from './pages/POS';
import AdminPage from './pages/Admin';
import SettingsPage from './pages/Settings';
import LandingPage from './pages/Landing';
import SuperAdminPage from './pages/SuperAdmin';
import BlogPage from './pages/Blog';
import BlogPostPage from './pages/BlogPost';
import DocsPage from './pages/Docs';
import NewsPage from './pages/News';
import NewsPostPage from './pages/NewsPost';
import SwaggerNotice from './pages/SwaggerNotice';
import ProtectedRoute from './components/layout/ProtectedRoute';
import { type AuthUser, type UserRole, useAuthStore } from './store/auth';
import MobileNav from './components/ui/MobileNav';
import { useRestaurantStore } from './store/restaurant';
import { useTheme } from './providers/ThemeProvider';

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

const ThemeScopeSync: React.FC = () => {
  const location = useLocation();
  const { setScope } = useTheme();

  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/pos') || path.startsWith('/settings')) {
      setScope('pos');
      return;
    }

    setScope('admin');
  }, [location.pathname, setScope]);

  return null;
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
      <ThemeScopeSync />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
        <Route path="/docs" element={<SwaggerNotice />} />
        <Route path="/help" element={<DocsPage />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/news/:slug" element={<NewsPostPage />} />
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
