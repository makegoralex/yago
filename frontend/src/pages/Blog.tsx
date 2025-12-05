import React from 'react';
import { Link } from 'react-router-dom';
import { blogPosts } from '../constants/content';

const BlogPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft sm:p-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Блог</p>
            <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Блог для владельцев кофеен</h1>
            <p className="mt-2 text-base text-slate-600">
              Практические статьи о запуске, учёте и развитии кофейни. Добавляйте материалы через CMS или в админке.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-secondary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-secondary/90"
          >
            ← На главную
          </Link>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {blogPosts.map((post) => (
            <article key={post.slug} className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50 p-5 shadow-sm">
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-secondary">{post.date}</div>
                <h2 className="text-xl font-bold text-slate-900">{post.title}</h2>
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
  );
};

export default BlogPage;
