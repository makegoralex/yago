import React, { useState } from 'react';
import api from '../../lib/api';
import { useToast } from '../../providers/ToastProvider';

export type LoyaltyModalProps = {
  open: boolean;
  onClose: () => void;
  onAttach: (customerId: string) => void;
};

type Customer = {
  _id: string;
  name: string;
  phone: string;
  points: number;
};

const LoyaltyModal: React.FC<LoyaltyModalProps> = ({ open, onClose, onAttach }) => {
  const { notify } = useToast();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSearch = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/customers/search', { params: { phone } });
      setResults(response.data.data ? [response.data.data] : []);
      if (!response.data.data) {
        notify({ title: 'Клиент не найден', description: 'Можно создать нового клиента ниже.' });
      }
    } catch (error) {
      notify({ title: 'Ошибка поиска', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const response = await api.post('/api/customers', { name, phone });
      setResults([response.data.data]);
      notify({ title: 'Клиент создан', type: 'success' });
    } catch (error) {
      notify({ title: 'Не удалось создать клиента', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-soft">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Программа лояльности</h2>
            <p className="mt-1 text-sm text-slate-500">Найдите гостя по номеру телефона или создайте нового.</p>
          </div>
          <button onClick={onClose} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-500">
            Закрыть
          </button>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 p-4">
            <h3 className="text-base font-semibold text-slate-900">Поиск клиента</h3>
            <label className="mt-3 block text-sm text-slate-500">Телефон</label>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+7 (999) 000-00-00"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base shadow-sm focus:border-secondary focus:bg-white"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={loading || !phone}
              className="mt-4 flex h-14 w-full items-center justify-center rounded-2xl bg-secondary text-base font-semibold text-white shadow-soft transition hover:bg-secondary/80 disabled:opacity-70"
            >
              {loading ? 'Поиск...' : 'Найти' }
            </button>
          </div>
          <div className="rounded-2xl border border-slate-100 p-4">
            <h3 className="text-base font-semibold text-slate-900">Новый клиент</h3>
            <label className="mt-3 block text-sm text-slate-500">Имя</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base shadow-sm focus:border-secondary focus:bg-white"
            />
            <label className="mt-3 block text-sm text-slate-500">Телефон</label>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base shadow-sm focus:border-secondary focus:bg-white"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={loading || !phone || !name}
              className="mt-4 flex h-14 w-full items-center justify-center rounded-2xl bg-primary text-base font-semibold text-white shadow-soft transition hover:bg-primary-dark disabled:opacity-70"
            >
              {loading ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </div>
        <div className="mt-6">
          <h3 className="text-base font-semibold text-slate-900">Результаты</h3>
          {results.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Нет выбранных клиентов.</p>
          ) : (
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {results.map((customer) => (
                <li key={customer._id} className="rounded-2xl border border-slate-100 p-4 shadow-sm">
                  <p className="text-base font-semibold text-slate-900">{customer.name}</p>
                  <p className="text-sm text-slate-500">{customer.phone}</p>
                  <p className="mt-1 text-sm text-emerald-600">{customer.points} баллов</p>
                  <button
                    type="button"
                    onClick={() => {
                      onAttach(customer._id);
                      notify({ title: 'Клиент выбран', description: customer.name, type: 'success' });
                      onClose();
                    }}
                    className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-secondary text-sm font-semibold text-white transition hover:bg-secondary/80"
                  >
                    Привязать
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoyaltyModal;
