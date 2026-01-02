type SeoPayload = {
  title: string;
  description?: string;
  keywords?: string;
};

const ensureMetaTag = (name: string) => {
  const existing = document.querySelector(`meta[name="${name}"]`);
  if (existing) return existing;
  const tag = document.createElement('meta');
  tag.setAttribute('name', name);
  document.head.appendChild(tag);
  return tag;
};

export const applySeo = ({ title, description, keywords }: SeoPayload) => {
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
};
