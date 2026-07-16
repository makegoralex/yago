export type ToolTheme = 'amber' | 'indigo' | 'emerald';

export type ToolDefinition = {
  slug: string;
  path: string;
  title: string;
  shortTitle: string;
  description: string;
  eyebrow: string;
  estimatedTime: string;
  theme: ToolTheme;
  keywords: string;
};

export const SITE_URL = 'https://yago-app.ru';

export const tools: ToolDefinition[] = [
  {
    slug: 'drink-cost-calculator',
    path: '/tools/drink-cost-calculator',
    title: 'Калькулятор себестоимости напитков',
    shortTitle: 'Себестоимость напитка',
    description:
      'Рассчитайте стоимость ингредиентов, упаковки, фудкост, маржу и рекомендуемую цену кофе или другого напитка.',
    eyebrow: 'Техкарта напитка',
    estimatedTime: '3 минуты',
    theme: 'amber',
    keywords:
      'калькулятор себестоимости напитка, себестоимость кофе, фудкост кофе, калькуляция напитка, техкарта кофе',
  },
  {
    slug: 'break-even-calculator',
    path: '/tools/break-even-calculator',
    title: 'Калькулятор прибыли и точки безубыточности',
    shortTitle: 'Прибыль и безубыточность',
    description:
      'Узнайте необходимую выручку и количество чеков, оцените операционную прибыль и запас финансовой прочности кофейни.',
    eyebrow: 'Финансовая модель',
    estimatedTime: '5 минут',
    theme: 'indigo',
    keywords:
      'калькулятор точки безубыточности, прибыль кофейни, расчет выручки кафе, маржинальная прибыль, экономика кофейни',
  },
  {
    slug: 'coffee-shop-opening-calculator',
    path: '/tools/coffee-shop-opening-calculator',
    title: 'Калькулятор открытия кофейни',
    shortTitle: 'Бюджет открытия кофейни',
    description:
      'Соберите стартовый бюджет кофейни, резерв оборотных средств и оцените прогнозную прибыль и срок окупаемости.',
    eyebrow: 'Бюджет запуска',
    estimatedTime: '7 минут',
    theme: 'emerald',
    keywords:
      'калькулятор открытия кофейни, сколько стоит открыть кофейню, бизнес план кофейни, бюджет кофейни, окупаемость кофейни',
  },
];

export const getTool = (slug: string) => tools.find((tool) => tool.slug === slug);

export const buildToolSchema = (tool: ToolDefinition) => [
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: tool.title,
    description: tool.description,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Любая',
    url: `${SITE_URL}${tool.path}`,
    inLanguage: 'ru-RU',
    isAccessibleForFree: true,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'RUB',
    },
    provider: {
      '@type': 'Organization',
      name: 'Yago App',
      url: SITE_URL,
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Yago', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Бесплатные инструменты', item: `${SITE_URL}/tools` },
      { '@type': 'ListItem', position: 3, name: tool.shortTitle, item: `${SITE_URL}${tool.path}` },
    ],
  },
];
