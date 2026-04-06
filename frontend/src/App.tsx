import React, { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import LoginPage from './pages/Login';
import POSPage from './pages/POS';
import SettingsPage from './pages/Settings';
import LandingPage from './pages/Landing';
import SwaggerNotice from './pages/SwaggerNotice';

const AdminPage = lazy(() => import('./pages/Admin'));
const SuperAdminPage = lazy(() => import('./pages/SuperAdmin'));
const KDSPage = lazy(() => import('./pages/KDS'));
const OSSPage = lazy(() => import('./pages/OSS'));
import ProtectedRoute from './components/layout/ProtectedRoute';
import { type AuthUser, type UserRole, useAuthStore } from './store/auth';
import MobileNav from './components/ui/MobileNav';
import { useRestaurantStore } from './store/restaurant';
import { useTheme } from './providers/ThemeProvider';

const BlogPage = lazy(() => import('./pages/Blog'));
const BlogPostPage = lazy(() => import('./pages/BlogPost'));

const DocsPage = lazy(() => import('./pages/Docs'));
const NewsPage = lazy(() => import('./pages/News'));
const NewsPostPage = lazy(() => import('./pages/NewsPost'));

const OWNER_ROLES: UserRole[] = ['owner'];

const getLandingRoute = (user: AuthUser | null): string => {
  if (!user) {
    return '/';
  }

  if (user.role === 'superAdmin') {
    return '/super-admin';
  }

  if (OWNER_ROLES.includes(user.role)) return '/admin';
  if (user.role === 'kitchen') return '/kds';
  return '/pos';
};

const ThemeScopeSync: React.FC = () => {
  const location = useLocation();
  const { setScope } = useTheme();

  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/pos') || path.startsWith('/settings') || path.startsWith('/kds') || path.startsWith('/oss')) {
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
      <Suspense fallback={<div style={{ padding: '24px' }}>Загрузка...</div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
        <Route path="/docs" element={<SwaggerNotice />} />
        <Route path="/help" element={<DocsPage />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/news/:slug" element={<NewsPostPage />} />
        <Route element={<ProtectedRoute allowed={['cashier', 'owner', 'kitchen']} />}>
          <Route path="/pos" element={<POSPage />} />
          <Route path="/kds" element={<KDSPage />} />
          <Route path="/oss" element={<OSSPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route element={<ProtectedRoute allowed={['owner', 'superAdmin']} />}>
          <Route path="/admin" element={<AdminPage />} />
        </Route>
        <Route element={<ProtectedRoute allowed={['superAdmin']} />}>
          <Route path="/super-admin" element={<SuperAdminPage />} />
        </Route>
        <Route path="/" element={user ? <Navigate to={getLandingRoute(user)} replace /> : <LandingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      <MobileNav />
    </>
  );
};

export default App;
