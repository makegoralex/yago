type SeoPayload = {
  title: string;
  description?: string;
  keywords?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  type?: string;
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

export const applySeo = ({ title, description, keywords, canonicalUrl, ogTitle, ogDescription, ogImage, type }: SeoPayload) => {
  if (typeof document === 'undefined') return;
  document.title = title;

  if (description !== undefined) {
    const tag = ensureMetaTag('description');
    tag.setAttribute('content', description);
  }

  if (keywords !== undefined) {
    const tag = ensureMetaTag('keywords');
    tag.setAttribute('content', keywords);
  }

  if (canonicalUrl) {
    ensureCanonicalLink().setAttribute('href', canonicalUrl);
  }

  ensurePropertyMetaTag('og:title').setAttribute('content', ogTitle || title);
  if (ogDescription || description) {
    ensurePropertyMetaTag('og:description').setAttribute('content', ogDescription || description || '');
  }
  if (ogImage) {
    ensurePropertyMetaTag('og:image').setAttribute('content', ogImage);
  }
  ensurePropertyMetaTag('og:type').setAttribute('content', type || 'website');
};
