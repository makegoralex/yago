export type ToolTheme = 'amber' | 'indigo' | 'emerald' | 'rose' | 'cyan';

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
  {
    slug: 'recipe-card-generator',
    path: '/tools/recipe-card-generator',
    title: 'Генератор технологических карт для кофейни',
    shortTitle: 'Генератор техкарт',
    description:
      'Создайте одностраничную техкарту для нескольких размеров с общей технологией, себестоимостью, логотипом и фото, затем скачайте PDF.',
    eyebrow: 'Документы кухни',
    estimatedTime: '5 минут',
    theme: 'rose',
    keywords:
      'генератор технологических карт, техкарта блюда онлайн, технологическая карта напитка, техкарта разных размеров, скачать техкарту pdf, техкарта для кофейни',
  },
  {
    slug: 'abc-xyz-analysis',
    path: '/tools/abc-xyz-analysis',
    title: 'ABC/XYZ-анализ ассортимента кофейни',
    shortTitle: 'ABC/XYZ-анализ меню',
    description:
      'Разделите позиции меню по вкладу в выручку и стабильности спроса, найдите лидеров, нестабильные товары и кандидатов на пересмотр.',
    eyebrow: 'Аналитика меню',
    estimatedTime: '7 минут',
    theme: 'cyan',
    keywords:
      'ABC XYZ анализ ассортимента, ABC анализ меню, XYZ анализ продаж, анализ ассортимента кофейни, матрица ABC XYZ онлайн',
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
