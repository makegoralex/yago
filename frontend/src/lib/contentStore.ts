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
import api from './api';

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

export const saveContent = async (nextContent: ContentCollection) => {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(nextContent));
  try {
    await api.put('/api/content', nextContent);
  } catch (error) {
    console.error('Failed to sync content to server:', error);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('yago-content-updated'));
  }
};

export const fetchContent = async (): Promise<ContentCollection> => {
  try {
    const response = await api.get('/api/content');
    const payload = normalizeContent(response.data?.data ?? null);
    const storage = getStorage();
    if (storage) {
      storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }
    return payload;
  } catch (error) {
    console.error('Failed to fetch content from server:', error);
    return loadContent();
  }
};

export const subscribeContentUpdates = (callback: (content: ContentCollection) => void) => {
  if (typeof window === 'undefined') return () => undefined;

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    callback(loadContent());
  };

  const handleCustomEvent = () => {
    callback(loadContent());
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener('yago-content-updated', handleCustomEvent);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('yago-content-updated', handleCustomEvent);
  };
};
