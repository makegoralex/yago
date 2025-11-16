import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { useRestaurantStore } from '../../store/restaurant';
type ShiftStatus = 'open' | 'closed' | 'loading';

type HeaderBarProps = {
  onToggleSidebar: () => void;
  isSidebarCollapsed: boolean;
  onShowHistory: () => void;
  onShowShift: () => void;
  shiftStatus: ShiftStatus;
};

const formatTime = (date: Date) =>
  date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

const HeaderBar: React.FC<HeaderBarProps> = ({
  onToggleSidebar,
  isSidebarCollapsed,
  onShowHistory,
  onShowShift,
  shiftStatus,
}) => {
  const { user } = useAuthStore();
  const restaurantName = useRestaurantStore((state) => state.name);
  const restaurantLogo = useRestaurantStore((state) => state.logoUrl);
  const navigate = useNavigate();
  const [now, setNow] = useState(() => formatTime(new Date()));

  useEffect(() => {
    const interval = window.setInterval(() => setNow(formatTime(new Date())), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <header className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-soft">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="hidden h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-secondary hover:text-secondary lg:flex"
        >
          {isSidebarCollapsed ? '☰' : '⟨'}
        </button>
        <div className="flex items-center gap-2">
          {restaurantLogo ? (
            <img
              src={restaurantLogo}
              alt={restaurantName}
              className="h-10 w-10 rounded-lg border border-slate-100 object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-400">
              Лого
            </div>
          )}
          <div>
            <p className="text-lg font-semibold text-slate-900 leading-tight">{restaurantName || 'Yago POS'}</p>
            <p className="text-[11px] text-slate-500">Управление продажами</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden flex-col text-right leading-tight md:flex">
          <span className="text-sm font-medium text-slate-700">{user?.name}</span>
          <span className="text-xs text-slate-400">{user?.role === 'admin' ? 'Администратор' : 'Кассир'}</span>
        </div>
        <div className="hidden text-right text-sm font-medium text-slate-700 lg:block">{now}</div>
        {user?.role === 'admin' ? (
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="hidden h-10 items-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:border-primary/40 hover:text-primary lg:flex"
          >
            Админка
          </button>
        ) : null}
        <button
          type="button"
          onClick={onShowShift}
          className={`relative flex h-10 w-10 items-center justify-center rounded-lg transition ${
            shiftStatus === 'open'
              ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
              : shiftStatus === 'loading'
              ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
          }`}
          aria-label="Состояние смены"
        >
          🕓
          <span
            className={`absolute bottom-1.5 right-1.5 inline-flex h-2.5 w-2.5 rounded-full ${
              shiftStatus === 'open'
                ? 'bg-emerald-500'
                : shiftStatus === 'loading'
                ? 'bg-amber-400'
                : 'bg-rose-500'
            }`}
          />
        </button>
        <button
          type="button"
          onClick={onShowHistory}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition hover:bg-slate-200"
          aria-label="История чеков"
        >
          🧾
        </button>
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="hidden h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition hover:bg-slate-200 md:flex"
          aria-label="Настройки"
        >
          ⚙️
        </button>
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="flex h-10 items-center rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 md:hidden"
        >
          Настройки
        </button>
      </div>
    </header>
  );
};

export default HeaderBar;
