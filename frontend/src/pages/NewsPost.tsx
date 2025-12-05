import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { newsItems } from '../constants/content';

const NewsPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const item = newsItems.find((entry) => entry.slug === slug);

  if (!item) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-soft sm:p-10">
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Запись не найдена</h1>
          <p className="mt-3 text-slate-600">Проверьте ссылку или вернитесь к списку новостей.</p>
          <div className="mt-5 flex justify-center gap-3">
            <Link
              to="/news"
              className="rounded-xl bg-secondary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-secondary/90"
            >
              К новостям
            </Link>
            <Link to="/" className="rounded-xl px-4 py-2 text-sm font-semibold text-secondary hover:bg-secondary/10">
              На главную
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft sm:p-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-secondary">{item.date}</p>
            <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">{item.title}</h1>
          </div>
          <Link
            to="/news"
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-secondary transition hover:bg-secondary/10"
          >
            ← Все обновления
          </Link>
        </div>

        <div className="mt-6 space-y-4 text-base leading-relaxed text-slate-700">
          {item.content.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </article>
    </div>
  );
};

export default NewsPostPage;
