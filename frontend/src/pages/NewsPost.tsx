import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import LandingHeader from '../components/ui/LandingHeader';
import { fetchContent, loadContent, subscribeContentUpdates } from '../lib/contentStore';
import { applySeo } from '../lib/seo';

const NewsPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [content, setContent] = useState(loadContent());
  const { newsItems } = content;
  const item = newsItems.find((entry) => entry.slug === slug);

  useEffect(() => subscribeContentUpdates(setContent), []);
  useEffect(() => {
    let isActive = true;
    fetchContent().then((nextContent) => {
      if (isActive) setContent(nextContent);
    });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!item) {
      applySeo({
        title: 'Новость не найдена | Yago POS',
        description: 'Запись не найдена. Вернитесь к списку новостей.',
      });
      return;
    }

    applySeo({
      title: item.seoTitle || item.title,
      description: item.seoDescription || item.description,
      keywords: item.seoKeywords || 'Yago POS, новости, касса, POS',
    });
  }, [item]);

  if (!item) {
    return (
      <div className="landing-shell min-h-screen">
        <LandingHeader />
        <div className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6">
          <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-soft sm:p-10">
            <h1 className="text-2xl font-semibold text-text sm:text-3xl">Запись не найдена</h1>
            <p className="mt-3 text-slate-600">Проверьте ссылку или вернитесь к списку новостей.</p>
            <div className="mt-5 flex justify-center gap-3">
              <Link
                to="/news"
                className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary/90"
              >
                К новостям
              </Link>
              <Link to="/" className="rounded-lg px-4 py-2 text-sm font-semibold text-secondary hover:bg-secondary/10">
                На главную
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="landing-shell min-h-screen">
      <LandingHeader />
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6">
        <article className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-secondary">{item.date}</p>
              <h1 className="text-3xl font-semibold text-text sm:text-4xl">{item.title}</h1>
            </div>
            <Link
              to="/news"
              className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-secondary transition hover:bg-secondary/10"
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
    </div>
  );
};

export default NewsPostPage;
