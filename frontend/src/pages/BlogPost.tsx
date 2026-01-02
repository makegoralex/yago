import React, { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import LandingHeader from '../components/ui/LandingHeader';
import { loadContent } from '../lib/contentStore';
import { applySeo } from '../lib/seo';

const BlogPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { blogPosts } = useMemo(() => loadContent(), []);
  const post = blogPosts.find((item) => item.slug === slug);

  useEffect(() => {
    if (!post) {
      applySeo({
        title: 'Статья не найдена | Yago POS',
        description: 'Страница не найдена. Вернитесь в блог.',
      });
      return;
    }

    applySeo({
      title: post.seoTitle || post.title,
      description: post.seoDescription || post.excerpt,
      keywords: post.seoKeywords || 'Yago POS, блог, кофейня, статьи, POS',
    });
  }, [post]);

  if (!post) {
    return (
      <div className="landing-shell min-h-screen">
        <LandingHeader />
        <div className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6">
          <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-soft sm:p-10">
            <h1 className="text-2xl font-semibold text-text sm:text-3xl">Статья не найдена</h1>
            <p className="mt-3 text-slate-600">Проверьте ссылку или вернитесь в блог.</p>
            <div className="mt-5 flex justify-center gap-3">
              <Link
                to="/blog"
                className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary/90"
              >
                К списку статей
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
              <p className="text-xs font-semibold uppercase tracking-wide text-secondary">{post.date}</p>
              <h1 className="text-3xl font-semibold text-text sm:text-4xl">{post.title}</h1>
            </div>
            <Link
              to="/blog"
              className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-secondary transition hover:bg-secondary/10"
            >
              ← Все статьи
            </Link>
          </div>

          <div className="mt-6 space-y-4 text-base leading-relaxed text-slate-700">
            {post.content.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
};

export default BlogPostPage;
