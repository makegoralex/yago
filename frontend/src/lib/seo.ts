type SeoPayload = {
  title: string;
  description?: string;
  keywords?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  type?: string;
  robots?: string;
  structuredData?: Record<string, unknown> | Record<string, unknown>[];
};

const ensureMetaTag = (name: string) => {
  const existing = document.querySelector(`meta[name="${name}"]`);
  if (existing) return existing;
  const tag = document.createElement('meta');
  tag.setAttribute('name', name);
  document.head.appendChild(tag);
  return tag;
};

const ensurePropertyMetaTag = (property: string) => {
  const existing = document.querySelector(`meta[property="${property}"]`);
  if (existing) return existing;
  const tag = document.createElement('meta');
  tag.setAttribute('property', property);
  document.head.appendChild(tag);
  return tag;
};

const ensureCanonicalLink = () => {
  const existing = document.querySelector('link[rel="canonical"]');
  if (existing) return existing;
  const tag = document.createElement('link');
  tag.setAttribute('rel', 'canonical');
  document.head.appendChild(tag);
  return tag;
};

const ensureStructuredData = (index: number) => {
  const selector = `script[data-yago-schema="${index}"]`;
  const existing = document.querySelector<HTMLScriptElement>(selector);
  if (existing) return existing;
  const tag = document.createElement('script');
  tag.type = 'application/ld+json';
  tag.dataset.yagoSchema = String(index);
  document.head.appendChild(tag);
  return tag;
};

const clearStructuredData = () => {
  document.querySelectorAll('script[data-yago-schema]').forEach((tag) => tag.remove());
};

export const applySeo = ({
  title,
  description,
  keywords,
  canonicalUrl,
  ogTitle,
  ogDescription,
  ogImage,
  type,
  robots = 'index, follow, max-image-preview:large',
  structuredData,
}: SeoPayload) => {
  if (typeof document === 'undefined') return;
  document.title = title;
  document.documentElement.lang = 'ru';

  if (description !== undefined) {
    const tag = ensureMetaTag('description');
    tag.setAttribute('content', description);
  }

  if (keywords !== undefined) {
    const tag = ensureMetaTag('keywords');
    tag.setAttribute('content', keywords);
  }

  const resolvedCanonicalUrl = canonicalUrl || `${window.location.origin}${window.location.pathname}`;
  ensureCanonicalLink().setAttribute('href', resolvedCanonicalUrl);
  ensurePropertyMetaTag('og:url').setAttribute('content', resolvedCanonicalUrl);

  ensureMetaTag('robots').setAttribute('content', robots);
  ensureMetaTag('yandex').setAttribute('content', 'index, follow');
  ensurePropertyMetaTag('og:title').setAttribute('content', ogTitle || title);
  if (ogDescription || description) {
    ensurePropertyMetaTag('og:description').setAttribute('content', ogDescription || description || '');
  }
  if (ogImage) {
    ensurePropertyMetaTag('og:image').setAttribute('content', ogImage);
    ensureMetaTag('twitter:image').setAttribute('content', ogImage);
  }
  ensurePropertyMetaTag('og:type').setAttribute('content', type || 'website');
  ensurePropertyMetaTag('og:locale').setAttribute('content', 'ru_RU');
  ensureMetaTag('twitter:card').setAttribute('content', ogImage ? 'summary_large_image' : 'summary');
  ensureMetaTag('twitter:title').setAttribute('content', ogTitle || title);
  if (ogDescription || description) {
    ensureMetaTag('twitter:description').setAttribute('content', ogDescription || description || '');
  }

  clearStructuredData();
  const schemaItems = structuredData ? (Array.isArray(structuredData) ? structuredData : [structuredData]) : [];
  schemaItems.forEach((schema, index) => {
    ensureStructuredData(index).textContent = JSON.stringify(schema).replace(/</g, '\\u003c');
  });
};
