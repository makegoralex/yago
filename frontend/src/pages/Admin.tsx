import React, { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '../lib/api';
import { useToast } from '../providers/ToastProvider';

const AdminPage: React.FC = () => {
  const { notify } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    avgCheck: 0,
    totalCustomers: 0,
    totalPointsIssued: 0,
    totalPointsRedeemed: 0,
  });
  const [daily, setDaily] = useState<{ date: string; revenue: number; orders: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number }[]>([]);
  const [topCustomers, setTopCustomers] = useState<{ name: string; totalSpent: number }[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [summaryRes, dailyRes, productsRes, customersRes] = await Promise.all([
          api.get('/api/reports/summary'),
          api.get('/api/reports/daily'),
          api.get('/api/reports/top-products'),
          api.get('/api/reports/top-customers'),
        ]);
        setSummary(summaryRes.data.data);
        setDaily(dailyRes.data.data);
        setTopProducts(productsRes.data.data);
        setTopCustomers(customersRes.data.data);
      } catch (error) {
        notify({ title: 'Не удалось загрузить отчеты', type: 'error' });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [notify]);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Админ-панель</h1>
          <p className="text-sm text-slate-500">Ключевые показатели бизнеса Yago Coffee</p>
        </div>
      </div>
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard title="Выручка" value={`${summary.totalRevenue.toFixed(2)} ₽`} />
            <SummaryCard title="Средний чек" value={`${summary.avgCheck.toFixed(2)} ₽`} />
            <SummaryCard title="Заказы" value={summary.totalOrders.toString()} />
            <SummaryCard title="Клиенты" value={summary.totalCustomers.toString()} />
          </div>
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <Card title="Выручка по дням">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 16,
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#ffffff',
                      }}
                    />
                    <Bar dataKey="revenue" fill="#10B981" radius={[12, 12, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="Топ продукты">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={topProducts}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" stroke="#64748b" />
                    <YAxis type="category" dataKey="name" stroke="#64748b" width={120} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 16,
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#ffffff',
                      }}
                    />
                    <Bar dataKey="qty" fill="#3B82F6" radius={[0, 12, 12, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <Card title="Лучшие клиенты">
              <ul className="space-y-3">
                {topCustomers.map((customer) => (
                  <li
                    key={customer.name}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-soft"
                  >
                    <span className="text-sm font-semibold text-slate-700">{customer.name}</span>
                    <span className="text-sm text-slate-500">{customer.totalSpent.toFixed(2)} ₽</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Баллы лояльности">
              <div className="rounded-2xl bg-emerald-50 p-6 text-emerald-700">
                <p className="text-sm">Начислено</p>
                <p className="text-3xl font-bold">{summary.totalPointsIssued.toFixed(0)} баллов</p>
                <p className="mt-4 text-sm">Использовано: {summary.totalPointsRedeemed.toFixed(0)} баллов</p>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

const Card: React.FC<React.PropsWithChildren<{ title: string }>> = ({ title, children }) => (
  <section className="rounded-3xl bg-white p-6 shadow-soft">
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
    </div>
    {children}
  </section>
);

const SummaryCard: React.FC<{ title: string; value: string }> = ({ title, value }) => (
  <div className="rounded-3xl bg-white p-6 shadow-soft">
    <p className="text-sm text-slate-500">{title}</p>
    <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
  </div>
);

export default AdminPage;
