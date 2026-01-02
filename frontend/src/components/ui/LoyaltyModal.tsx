import React, { useCallback, useEffect, useRef, useState } from 'react';

import api from '../../lib/api';
import type { CustomerSummary } from '../../store/order';

export type LoyaltyModalProps = {
  open: boolean;
  onClose: () => void;
  onAttach: (customer: CustomerSummary) => void;
};

const normalizePhone = (value: string): string => value.replace(/\D/g, '');
const MIN_PHONE_SEARCH_LENGTH = 4;
const defaultPhoneValue = '+7';

const LoyaltyModal: React.FC<LoyaltyModalProps> = ({ open, onClose, onAttach }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [createPhone, setCreatePhone] = useState(defaultPhoneValue);
  const [name, setName] = useState('');
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [suggestions, setSuggestions] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const modalScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let isMounted = true;
    setLoading(true);

    api
      .get('/api/customers')
      .then((response) => {
        if (!isMounted) return;
        const items = Array.isArray(response.data.data) ? response.data.data : [];
        const mapped: CustomerSummary[] = items.map((customer: any) => ({
          _id: String(customer._id),
          name: customer.name ?? 'Гость',
          phone: customer.phone ?? '',
          points: typeof customer.points === 'number' ? customer.points : 0,
        }));
        setCustomers(mapped);
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    setSearchQuery('');
    setCreatePhone(defaultPhoneValue);
    setName('');
    setSuggestions([]);

    return () => {
      isMounted = false;
      setSuggestions([]);
    };
  }, [open]);

  const filterCustomers = useCallback(
    (query: string) => {
      const trimmedQuery = query.trim();
      const hasLetters = /[a-zа-яё]/i.test(trimmedQuery);
      const searchValue = normalizePhone(trimmedQuery);
      const isPhoneQueryReady = searchValue.length >= MIN_PHONE_SEARCH_LENGTH;

      if (!isPhoneQueryReady && !hasLetters) {
        return [];
      }

      return customers.filter((customer) => {
        const customerPhone = normalizePhone(customer.phone ?? '');
        const matchesPhone = isPhoneQueryReady ? customerPhone.includes(searchValue) : false;
        const matchesName = hasLetters
          ? customer.name.toLowerCase().includes(trimmedQuery.toLowerCase())
          : false;
        return matchesPhone || matchesName;
      });
    },
    [customers]
  );

  useEffect(() => {
    if (!open) {
      setSuggestions([]);
      return;
    }

    const filtered = filterCustomers(searchQuery);
    setSuggestions(filtered.slice(0, 5));
  }, [filterCustomers, open, searchQuery]);

  useEffect(() => {
    if (open) {
      if (modalScrollRef.current) {
        modalScrollRef.current.scrollTo({ top: 0 });
      }
    }
  }, [open, searchQuery, suggestions.length]);

  const attachAndClose = (customer: CustomerSummary) => {
    onAttach(customer);
    onClose();
  };

  if (!open) return null;

  const handleSearchQueryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchQuery(value);
  };

  const handleCreatePhoneChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (!value.trim()) {
      setCreatePhone(defaultPhoneValue);
      return;
    }
    setCreatePhone(value);
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const response = await api.post('/api/customers', { name, phone: createPhone });
      const created: CustomerSummary = {
        _id: String(response.data.data._id),
        name: response.data.data.name ?? name,
        phone: response.data.data.phone ?? createPhone,
        points: typeof response.data.data.points === 'number' ? response.data.data.points : 0,
      };
      setCustomers((prev) => [created, ...prev]);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={modalScrollRef}
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-slate-900/50 px-4 py-6"
    >
      <div className="mx-auto w-full max-w-2xl rounded-3xl bg-white p-6 shadow-soft">
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
              value={searchQuery}
              onChange={handleSearchQueryChange}
              placeholder="Телефон или имя"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base shadow-sm focus:border-secondary focus:bg-white"
            />
            {suggestions.length > 0 ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs uppercase text-slate-400">Совпадения</p>
                <ul className="space-y-2">
                  {suggestions.map((customer) => (
                    <li key={customer._id}>
                      <button
                        type="button"
                        onClick={() => attachAndClose(customer)}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-left text-sm text-slate-600 transition hover:border-secondary hover:bg-secondary/10"
                      >
                        <span className="block font-semibold text-slate-900">{customer.name}</span>
                        <span className="text-xs text-slate-500">{customer.phone}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
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
              value={createPhone}
              onChange={handleCreatePhoneChange}
              placeholder="+7 (999) 000-00-00"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base shadow-sm focus:border-secondary focus:bg-white"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={loading || normalizePhone(createPhone).length < MIN_PHONE_SEARCH_LENGTH || !name}
              className="mt-4 flex h-14 w-full items-center justify-center rounded-2xl bg-primary text-base font-semibold text-white shadow-soft transition hover:bg-primary-dark disabled:opacity-70"
            >
              {loading ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoyaltyModal;
