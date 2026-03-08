import React, { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';

type KdsOrder = {
  _id: string;
  items: Array<{ name: string; qty: number }>;
  kitchenStatus?: 'pending' | 'in_progress' | 'ready';
  kitchenQueuedAt?: string;
  customerId?: { name?: string } | null;
};

const statusLabel: Record<string, string> = {
  pending: 'Ожидает старта',
  in_progress: 'Готовится',
  ready: 'Готово',
};

const KDSPage: React.FC = () => {
  const [orders, setOrders] = useState<KdsOrder[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [mode, setMode] = useState<'per-order' | 'queue'>('per-order');

  const load = async () => {
    const response = await api.get('/api/orders/kitchen/board');
    setOrders(response.data?.data?.orders ?? []);
    setEnabled(Boolean(response.data?.data?.enabled));
    setMode(response.data?.data?.mode === 'queue' ? 'queue' : 'per-order');
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const queueItems = useMemo(() => {
    const map = new Map<string, number>();
    for (const order of orders) {
      if (order.kitchenStatus === 'ready') continue;
      for (const item of order.items ?? []) {
        map.set(item.name, (map.get(item.name) ?? 0) + Number(item.qty ?? 0));
      }
    }
    return Array.from(map.entries()).map(([name, qty]) => ({ name, qty }));
  }, [orders]);

  const queueOrders = useMemo(
    () => orders.filter((order) => order.kitchenStatus === 'pending' || order.kitchenStatus === 'in_progress'),
    [orders]
  );

  const update = async (orderId: string, action: 'start' | 'ready') => {
    await api.post(`/api/orders/${orderId}/kitchen/${action}`);
    await load();
  };

  if (!enabled) return <div className="p-6">KDS выключен в настройках ресторана.</div>;

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <h1 className="text-2xl font-bold">Kitchen Display System</h1>
      {mode === 'queue' ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-[2fr,1fr]">
          <section>
            <p className="mb-3 text-sm text-slate-300">Общая очередь позиций</p>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {queueItems.map((item) => (
                <div key={item.name} className="rounded-xl bg-slate-900 p-4">
                  <p className="text-lg font-semibold">{item.name}</p>
                  <p className="text-3xl font-bold">×{item.qty}</p>
                </div>
              ))}
              {queueItems.length === 0 ? (
                <div className="rounded-xl bg-slate-900 p-4 text-sm text-slate-300">Нет позиций в работе.</div>
              ) : null}
            </div>
          </section>

          <section>
            <p className="mb-3 text-sm text-slate-300">Управление заказами</p>
            <div className="space-y-3">
              {queueOrders.map((order) => (
                <div key={order._id} className="rounded-xl bg-slate-900 p-4">
                  <p className="text-sm font-semibold">Заказ #{order._id.slice(-5)}</p>
                  <p className="text-xs text-slate-300">{statusLabel[order.kitchenStatus ?? 'pending']}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      className="rounded bg-amber-500 px-3 py-1 text-sm disabled:opacity-50"
                      onClick={() => void update(order._id, 'start')}
                      disabled={order.kitchenStatus === 'in_progress'}
                    >
                      Старт
                    </button>
                    <button className="rounded bg-emerald-600 px-3 py-1 text-sm" onClick={() => void update(order._id, 'ready')}>
                      Готово
                    </button>
                  </div>
                </div>
              ))}
              {queueOrders.length === 0 ? (
                <div className="rounded-xl bg-slate-900 p-4 text-sm text-slate-300">Нет заказов для действий.</div>
              ) : null}
            </div>
          </section>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orders.map((order) => (
            <div key={order._id} className="rounded-xl bg-slate-900 p-4">
              <p className="text-lg font-semibold">Заказ #{order._id.slice(-5)}</p>
              <p className="text-xs text-slate-300">{statusLabel[order.kitchenStatus ?? 'pending']}</p>
              <ul className="mt-3 space-y-1 text-sm">
                {order.items?.map((item, index) => (
                  <li key={`${order._id}-${index}`}>
                    {item.name} × {item.qty}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex gap-2">
                <button className="rounded bg-amber-500 px-3 py-1 text-sm" onClick={() => void update(order._id, 'start')}>
                  Старт
                </button>
                <button className="rounded bg-emerald-600 px-3 py-1 text-sm" onClick={() => void update(order._id, 'ready')}>
                  Готово
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default KDSPage;
