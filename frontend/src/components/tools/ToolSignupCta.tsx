import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { useToast } from '../../providers/ToastProvider';
import { type AuthUser, useAuthStore } from '../../store/auth';

const ToolSignupCta: React.FC = () => {
  const navigate = useNavigate();
  const { setSession } = useAuthStore();
  const { notify } = useToast();
  const [organizationName, setOrganizationName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!consent) return;
    setLoading(true);
    try {
      const response = await api.post('/api/organizations/public/create', {
        name: organizationName,
        owner: { name: ownerName, email, password },
      });
      const payload = response.data?.data ?? response.data;
      const accessToken = payload?.accessToken ?? payload?.tokens?.accessToken;
      const refreshToken = payload?.refreshToken ?? payload?.tokens?.refreshToken;
      const payloadUser = payload?.owner ?? payload?.user;
      const identifier = payloadUser?.id ?? payloadUser?._id;
      if (!accessToken || !refreshToken || !identifier) throw new Error('Incomplete signup response');

      const user: AuthUser = {
        _id: identifier,
        id: identifier,
        name: payloadUser?.name ?? ownerName,
        email: payloadUser?.email ?? email,
        role: payloadUser?.role ?? 'owner',
        organizationId: payloadUser?.organizationId ?? payload?.organization?.id,
      };
      setSession({ user, accessToken, refreshToken, remember: true });
      notify({ title: 'Кабинет Yago создан', description: 'Можно добавить меню и провести первый заказ.', type: 'success' });
      navigate('/pos');
    } catch (error: any) {
      notify({
        title: 'Не удалось создать кабинет',
        description: error?.response?.data?.error ?? 'Проверьте данные и попробуйте ещё раз.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="become-client" className="mt-8 overflow-hidden rounded-3xl bg-slate-950 text-white">
      <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
        <div className="p-6 sm:p-8 lg:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-violet-300">От расчёта к контролю</p>
          <h2 className="mt-3 heading-font text-3xl font-semibold">Считайте экономику автоматически в Yago</h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
            Техкарты, фактическая себестоимость, продажи, остатки и лояльность кофейни — в одном кабинете.
          </p>
          <ul className="mt-6 grid gap-2 text-sm text-slate-200 sm:grid-cols-2 lg:grid-cols-1">
            <li>✓ 14 дней бесплатно</li>
            <li>✓ Работает с Эвотором и АТОЛ</li>
            <li>✓ Без долгосрочных обязательств</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 bg-white p-6 text-slate-900 sm:grid-cols-2 sm:p-8 lg:p-10">
          <label className="block sm:col-span-2">
            <span className="text-sm font-semibold">Название кофейни</span>
            <input required value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} className="mt-1.5 h-11 w-full px-3" placeholder="Кофе на районе" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Ваше имя</span>
            <input required value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className="mt-1.5 h-11 w-full px-3" placeholder="Александр" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Email</span>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 h-11 w-full px-3" placeholder="owner@coffee.ru" />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-semibold">Пароль</span>
            <input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 h-11 w-full px-3" placeholder="Не менее 8 символов" />
          </label>
          <label className="flex items-start gap-3 text-sm leading-5 text-slate-600 sm:col-span-2">
            <input required type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4" />
            <span>
              Я согласен на обработку персональных данных и принимаю{' '}
              <a href="/privacy-policy.pdf" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary">политику обработки данных</a>.
            </span>
          </label>
          <button disabled={loading} className="h-12 rounded-xl bg-primary px-5 font-semibold text-white hover:bg-primary-dark disabled:opacity-60 sm:col-span-2">
            {loading ? 'Создаём кабинет…' : 'Стать клиентом Yago — 14 дней бесплатно'}
          </button>
        </form>
      </div>
    </section>
  );
};

export default ToolSignupCta;
