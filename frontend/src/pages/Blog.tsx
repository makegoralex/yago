import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import LandingHeader from '../components/ui/LandingHeader';
import { fetchContent, loadContent, subscribeContentUpdates } from '../lib/contentStore';
import { applySeo } from '../lib/seo';

const BlogPage: React.FC = () => {
  const [content, setContent] = useState(loadContent());
  const { blogPosts } = content;

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
      title: 'Блог Yago POS',
      description: 'Статьи и советы для владельцев кофеен: учет, маркетинг, развитие бизнеса.',
      keywords: 'Yago POS, блог, кофейня, статьи, бизнес, учет',
    });
  }, []);

  return (
    <div className="landing-shell min-h-screen">
      <LandingHeader />
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-10 sm:px-6">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Блог</p>
              <h1 className="text-3xl font-semibold text-text sm:text-4xl">Блог для владельцев кофеен</h1>
              <p className="mt-2 text-base text-slate-600">
                Практические статьи о запуске, учёте и развитии кофейни. Добавляйте материалы через CMS или в админке.
              </p>
            </div>
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary/90"
            >
              ← На главную
            </Link>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {blogPosts.map((post) => (
              <article key={post.slug} className="flex flex-col justify-between rounded-xl border border-border bg-white p-5 shadow-soft">
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-secondary">{post.date}</div>
                  <h2 className="text-xl font-semibold text-text">{post.title}</h2>
                  <p className="text-sm text-slate-600">{post.excerpt}</p>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm font-semibold text-secondary">
                  <Link to={`/blog/${post.slug}`} className="hover:text-secondary/80">
                    Читать статью
                  </Link>
                  <span>→</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlogPage;
