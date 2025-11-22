import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore, type UserRole } from '../../store/auth';

type ProtectedRouteProps = {
  allowed?: UserRole[];
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowed }) => {
  const { user } = useAuthStore();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (allowed && !allowed.includes(user.role)) {
    if (user.role === 'superAdmin') {
      return <Navigate to="/super-admin" replace />;
    }

    return <Navigate to="/pos" replace />;
  }
  return <Outlet />;
};

export default ProtectedRoute;
