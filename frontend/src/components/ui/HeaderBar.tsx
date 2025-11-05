import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { useTheme } from '../../providers/ThemeProvider';

const formatTime = (date: Date) =>
  date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

const HeaderBar: React.FC<{ onToggleSidebar: () => void; isSidebarCollapsed: boolean }> = ({
  onToggleSidebar,
  isSidebarCollapsed,
}) => {
  const { user, clearSession } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => formatTime(new Date()));

  useEffect(() => {
    const interval = window.setInterval(() => setNow(formatTime(new Date())), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <header className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-soft">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="hidden h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-secondary hover:text-secondary lg:flex"
        >
          {isSidebarCollapsed ? '☰' : '⟨'}
        </button>
        <div>
          <p className="text-xl font-semibold text-slate-900">Yago POS</p>
          <p className="text-xs text-slate-500">Управление продажами</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden flex-col text-right md:flex">
          <span className="text-sm font-medium text-slate-700">{user?.name}</span>
          <span className="text-xs text-slate-400">{user?.role === 'admin' ? 'Администратор' : 'Кассир'}</span>
        </div>
        <div className="hidden text-right text-sm font-medium text-slate-600 lg:block">{now}</div>
        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-slate-200"
          aria-label="Переключить тему"
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 md:flex"
          aria-label="Настройки"
        >
          ⚙️
        </button>
        <button
          type="button"
          onClick={() => {
            clearSession();
            navigate('/login');
          }}
          className="flex h-12 items-center rounded-2xl bg-red-50 px-4 text-sm font-semibold text-red-500 transition hover:bg-red-100"
        >
          Выход
        </button>
      </div>
    </header>
  );
};

export default HeaderBar;
