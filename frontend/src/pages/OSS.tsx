import React, { useEffect, useState } from 'react';
import api from '../lib/api';

type OssOrder = {
  _id: string;
  customerId?: { name?: string } | null;
};

const OSSPage: React.FC = () => {
  const [enabled, setEnabled] = useState(true);
  const [preparing, setPreparing] = useState<OssOrder[]>([]);
  const [ready, setReady] = useState<OssOrder[]>([]);

  const load = async () => {
    const response = await api.get('/api/orders/oss');
    setEnabled(Boolean(response.data?.data?.enabled));
    setPreparing(response.data?.data?.preparing ?? []);
    setReady(response.data?.data?.ready ?? []);
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  if (!enabled) return <div className="p-6">Экран статусов отключен в настройках ресторана.</div>;

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-white">
      <h1 className="text-2xl font-bold">Order Status Screen</h1>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="text-xl font-semibold text-amber-300">Готовятся</h2>
          <div className="mt-3 space-y-2">
            {preparing.map((order) => (
              <div key={order._id} className="rounded-lg bg-slate-800 p-3">
                #{order._id.slice(-5)} — {order.customerId?.name || 'Гость'}
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-emerald-300">Готовы</h2>
          <div className="mt-3 space-y-2">
            {ready.map((order) => (
              <div key={order._id} className="rounded-lg bg-emerald-900/50 p-3">
                #{order._id.slice(-5)} — {order.customerId?.name || 'Гость'}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default OSSPage;
