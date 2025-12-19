import React from 'react';
import { NavLink } from 'react-router-dom';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useAuthStore } from '../../store/auth';

const MobileNav: React.FC = () => {
  const isTablet = useMediaQuery('(min-width: 1024px)');
  const user = useAuthStore((state) => state.user);

  if (isTablet || !user || user.role === 'superAdmin') {
    return null;
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex justify-around border-t border-slate-200 bg-white/95 py-2 backdrop-blur">
      <NavItem to="/pos" label="pos" />
      <NavItem to="/settings" label="Настройки" />
      <NavItem to="/admin" label="Админ-панель" disabled={user.role !== 'owner'} />
    </nav>
  );
};

type NavItemProps = {
  to: string;
  label: string;
  disabled?: boolean;
};

const NavItem: React.FC<NavItemProps> = ({ to, label, disabled }) => {
  if (disabled) {
    return (
      <span className="flex h-12 flex-1 items-center justify-center rounded-2xl text-sm text-slate-300">
        {label}
      </span>
    );
  }
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex h-12 flex-1 items-center justify-center rounded-2xl text-sm font-semibold transition ${
          isActive ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:text-primary'
        }`
      }
    >
      {label}
    </NavLink>
  );
};

export default MobileNav;
