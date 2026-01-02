import {
  blogPosts,
  instructionLinks,
  newsItems,
  screenshotGallery,
  type BlogPost,
  type InstructionLink,
  type NewsItem,
  type ScreenshotItem,
} from '../constants/content';

export type ContentCollection = {
  newsItems: NewsItem[];
  blogPosts: BlogPost[];
  instructionLinks: InstructionLink[];
  screenshotGallery: ScreenshotItem[];
};

const STORAGE_KEY = 'yago-content';

const defaultContent: ContentCollection = {
  newsItems,
  blogPosts,
  instructionLinks,
  screenshotGallery,
};

const getStorage = () => (typeof window === 'undefined' ? null : window.localStorage);

const parseContent = (raw: string | null): ContentCollection | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ContentCollection;
  } catch {
    return null;
  }
};

const normalizeContent = (payload: ContentCollection | null): ContentCollection => ({
  newsItems: Array.isArray(payload?.newsItems) ? payload!.newsItems : defaultContent.newsItems,
  blogPosts: Array.isArray(payload?.blogPosts) ? payload!.blogPosts : defaultContent.blogPosts,
  instructionLinks: Array.isArray(payload?.instructionLinks) ? payload!.instructionLinks : defaultContent.instructionLinks,
  screenshotGallery: Array.isArray(payload?.screenshotGallery) ? payload!.screenshotGallery : defaultContent.screenshotGallery,
});

export const loadContent = (): ContentCollection => {
  const storage = getStorage();
  if (!storage) return defaultContent;
  const saved = parseContent(storage.getItem(STORAGE_KEY));
  return normalizeContent(saved);
};

export const saveContent = (nextContent: ContentCollection) => {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(nextContent));
};
