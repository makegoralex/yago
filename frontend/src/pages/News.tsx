import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone } from 'lucide-react';
import LandingHeader from '../components/ui/LandingHeader';
import { loadContent, subscribeContentUpdates } from '../lib/contentStore';
import { applySeo } from '../lib/seo';

const NewsPage: React.FC = () => {
  const [content, setContent] = useState(loadContent());
  const { newsItems } = content;

  useEffect(() => subscribeContentUpdates(setContent), []);

  useEffect(() => {
    applySeo({
      title: 'Новости Yago POS',
      description: 'Свежие обновления, новые функции и улучшения в Yago POS.',
      keywords: 'Yago POS, новости, обновления, касса, POS',
    });
  }, []);

  return (
    <div className="landing-shell min-h-screen">
      <LandingHeader />
      <div className="mx-auto max-w-4xl px-4 pb-16 pt-10 sm:px-6">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Новости</p>
              <h1 className="text-3xl font-semibold text-text sm:text-4xl">Что нового в Yago POS</h1>
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
                className="flex flex-col gap-2 rounded-xl border border-border bg-white p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-secondary">{item.date}</div>
                  <div className="text-lg font-semibold text-text">{item.title}</div>
                  <p className="text-sm text-slate-600">{item.description}</p>
                  <Link to={`/news/${item.slug}`} className="inline-flex items-center gap-1 text-sm font-semibold text-secondary">
                    Читать полностью
                    <span>→</span>
                  </Link>
                </div>
                <Megaphone size={20} className="text-secondary" />
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewsPage;
