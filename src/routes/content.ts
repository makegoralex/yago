import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { authMiddleware, requireRole } from '../middleware/auth';
import { BlogPostModel, type BlogPostDocument } from '../models/BlogPost';

const contentRouter = Router();

const contentFilePath = path.resolve(process.cwd(), 'data', 'content.json');

type ContentPayload = {
  newsItems?: unknown[];
  blogPosts?: BlogPostPayload[];
  instructionLinks?: unknown[];
  screenshotGallery?: unknown[];
};

type BlogPostPayload = {
  slug?: string;
  title?: string;
  date?: string;
  excerpt?: string;
  content?: string[];
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  focusKeyword?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  status?: 'draft' | 'published';
  publishedAt?: string | Date | null;
};

const readContentFile = async (): Promise<ContentPayload | null> => {
  try {
    const raw = await fs.readFile(contentFilePath, 'utf-8');
    return JSON.parse(raw) as ContentPayload;
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
};

const writeContentFile = async (payload: unknown) => {
  await fs.mkdir(path.dirname(contentFilePath), { recursive: true });
  await fs.writeFile(contentFilePath, JSON.stringify(payload, null, 2), 'utf-8');
};

const serializeBlogPost = (post: BlogPostDocument) => ({
  slug: post.slug,
  title: post.title,
  date: post.date,
  excerpt: post.excerpt,
  content: post.content,
  seoTitle: post.seoTitle,
  seoDescription: post.seoDescription,
  seoKeywords: post.seoKeywords,
  focusKeyword: post.focusKeyword,
  canonicalUrl: post.canonicalUrl,
  ogTitle: post.ogTitle,
  ogDescription: post.ogDescription,
  ogImage: post.ogImage,
  status: post.status,
  publishedAt: post.publishedAt?.toISOString() ?? null,
});

const normalizeBlogPost = (post: BlogPostPayload) => {
  const title = String(post.title ?? '').trim() || 'Черновик поста';
  const slug = String(post.slug ?? title)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '') || `post-${Date.now()}`;
  const status = post.status === 'draft' ? 'draft' : 'published';
  const publishedAt = post.publishedAt ? new Date(post.publishedAt) : status === 'published' ? new Date() : null;

  return {
    slug,
    title,
    date: String(post.date ?? '').trim() || new Intl.DateTimeFormat('ru-RU').format(new Date()),
    excerpt: String(post.excerpt ?? '').trim() || 'Добавьте превью статьи.',
    content: Array.isArray(post.content) ? post.content.map((item) => String(item)).filter(Boolean) : [],
    seoTitle: String(post.seoTitle ?? '').trim() || title,
    seoDescription: String(post.seoDescription ?? '').trim() || String(post.excerpt ?? '').trim(),
    seoKeywords: String(post.seoKeywords ?? '').trim(),
    focusKeyword: String(post.focusKeyword ?? '').trim(),
    canonicalUrl: String(post.canonicalUrl ?? '').trim(),
    ogTitle: String(post.ogTitle ?? '').trim(),
    ogDescription: String(post.ogDescription ?? '').trim(),
    ogImage: String(post.ogImage ?? '').trim(),
    status,
    publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
  };
};

const listBlogPosts = async (includeDrafts = false) => {
  const query = includeDrafts ? {} : { status: 'published' };
  const posts = await BlogPostModel.find(query).sort({ publishedAt: -1, updatedAt: -1 }).exec();
  return posts.map(serializeBlogPost);
};

contentRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const filePayload = await readContentFile();
    const blogPosts = await listBlogPosts(false);
    res.json({
      data: {
        newsItems: filePayload?.newsItems,
        blogPosts: blogPosts.length ? blogPosts : filePayload?.blogPosts,
        instructionLinks: filePayload?.instructionLinks,
        screenshotGallery: filePayload?.screenshotGallery,
      },
    });
  } catch (error) {
    console.error('Failed to read content:', error);
    res.status(500).json({ data: null, error: 'Failed to read content' });
  }
});

contentRouter.get('/admin', authMiddleware, requireRole('superAdmin'), async (_req: Request, res: Response) => {
  try {
    const filePayload = await readContentFile();
    const blogPosts = await listBlogPosts(true);
    res.json({
      data: {
        newsItems: filePayload?.newsItems,
        blogPosts: blogPosts.length ? blogPosts : filePayload?.blogPosts,
        instructionLinks: filePayload?.instructionLinks,
        screenshotGallery: filePayload?.screenshotGallery,
      },
    });
  } catch (error) {
    console.error('Failed to read admin content:', error);
    res.status(500).json({ data: null, error: 'Failed to read content' });
  }
});

contentRouter.put('/', authMiddleware, requireRole('superAdmin'), async (req: Request, res: Response) => {
  try {
    const payload = (req.body ?? {}) as ContentPayload;
    const blogPosts = Array.isArray(payload.blogPosts) ? payload.blogPosts.map(normalizeBlogPost) : [];

    for (const post of blogPosts) {
      await BlogPostModel.findOneAndUpdate({ slug: post.slug }, post, { upsert: true, new: true, setDefaultsOnInsert: true }).exec();
    }

    await BlogPostModel.deleteMany({ slug: { $nin: blogPosts.map((post) => post.slug) } }).exec();
    await writeContentFile({ ...payload, blogPosts: undefined });

    res.json({ data: true });
  } catch (error) {
    console.error('Failed to save content:', error);
    res.status(500).json({ data: null, error: 'Failed to save content' });
  }
});

export default contentRouter;
