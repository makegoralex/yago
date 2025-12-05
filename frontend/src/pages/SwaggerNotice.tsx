import React from 'react';
import { Link } from 'react-router-dom';

const SwaggerNotice: React.FC = () => {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="rounded-3xl border border-amber-100 bg-amber-50 p-6 shadow-soft sm:p-10">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Swagger доступен в /docs</h1>
        <p className="mt-3 text-base text-slate-700">
          Этот фронтенд не перехватывает /docs — здесь расположен Swagger по API. Руководства и пошаговые инструкции переехали в
          раздел /help.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
          <a
            href="/docs"
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-white shadow-sm transition hover:bg-slate-800"
          >
            Открыть Swagger
          </a>
          <Link to="/help" className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-white shadow-sm transition hover:bg-primary-dark">
            Перейти в /help
          </Link>
          <Link to="/" className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-secondary transition hover:bg-secondary/10">
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SwaggerNotice;
