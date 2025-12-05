import React from 'react';
import { Link } from 'react-router-dom';
import { newsItems } from '../constants/content';

const NewsPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft sm:p-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Новости</p>
            <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Что нового в Yago POS</h1>
            <p className="mt-2 text-base text-slate-600">Лаконичный changelog для владельцев. Последние обновления ниже.</p>
          </div>
          <Link to="/" className="rounded-xl px-4 py-2 text-sm font-semibold text-secondary hover:bg-secondary/10">
            ← На главную
          </Link>
        </div>

        <div className="mt-8 space-y-4">
          {newsItems.map((item) => (
            <article
              key={item.slug}
              className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-secondary">{item.date}</div>
                <div className="text-lg font-bold text-slate-900">{item.title}</div>
                <p className="text-sm text-slate-600">{item.description}</p>
                <Link to={`/news/${item.slug}`} className="inline-flex items-center gap-1 text-sm font-semibold text-secondary">
                  Читать полностью
                  <span>→</span>
                </Link>
              </div>
              <span className="text-2xl">🆕</span>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NewsPage;
