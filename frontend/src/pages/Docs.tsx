import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import LandingHeader from '../components/ui/LandingHeader';
import { fetchContent, loadContent, subscribeContentUpdates } from '../lib/contentStore';
import { applySeo } from '../lib/seo';

const DocsPage: React.FC = () => {
  const [content, setContent] = useState(loadContent());
  const { instructionLinks } = content;

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
    applySeo({
      title: 'Инструкции Yago POS',
      description: 'Гайды и инструкции по запуску и использованию Yago POS.',
      keywords: 'Yago POS, инструкции, help, гайды, POS',
    });
  }, []);

  return (
    <div className="landing-shell min-h-screen">
      <LandingHeader />
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-10 sm:px-6">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Инструкции</p>
              <h1 className="text-3xl font-semibold text-text sm:text-4xl">Гайды по запуску Yago POS</h1>
              <p className="mt-2 text-base text-slate-600">
                Раздел /docs оставили под Swagger API. Все инструкции переехали на /help: сохраняйте ссылки в планшете или отправляйте
                сотрудникам. Страницы готовы для загрузки из CMS или markdown.
              </p>
            </div>
            <Link to="/" className="rounded-lg px-4 py-2 text-sm font-semibold text-secondary hover:bg-secondary/10">
              ← На главную
            </Link>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {instructionLinks.map((item) => (
              <a
                key={item.title}
                href={item.href}
                className="rounded-xl border border-border bg-white p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-secondary/50 hover:shadow-lg"
              >
                <div className="text-sm font-semibold uppercase tracking-wide text-secondary">Инструкция</div>
                <div className="mt-2 text-lg font-semibold text-text">{item.title}</div>
                <p className="mt-1 text-sm text-slate-600">Открывается в CMS или markdown-файле по ссылке {item.href}</p>
              </a>
            ))}
          </div>

          <div className="mt-8 rounded-xl border border-border bg-background p-5 text-sm text-slate-700">
            <div className="font-semibold text-text">Нет нужного гайда?</div>
            <p className="mt-1">Добавьте страницу в CMS или пришлите markdown — мы подключим её в раздел /help.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocsPage;
