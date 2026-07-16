const SITE_URL = 'https://yago-app.ru';

type SeoPage = {
  title: string;
  description: string;
  keywords: string;
  canonicalPath: string;
  type?: 'website' | 'article';
  schema: Record<string, unknown>[];
  fallbackHtml: string;
};

const toolSchema = (name: string, description: string, path: string): Record<string, unknown> => ({
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name,
  description,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Любая',
  url: `${SITE_URL}${path}`,
  inLanguage: 'ru-RU',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'RUB' },
  provider: { '@type': 'Organization', name: 'Yago App', url: SITE_URL },
});

const breadcrumbSchema = (name: string, path: string): Record<string, unknown> => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Yago', item: `${SITE_URL}/` },
    { '@type': 'ListItem', position: 2, name: 'Бесплатные инструменты', item: `${SITE_URL}/tools` },
    { '@type': 'ListItem', position: 3, name, item: `${SITE_URL}${path}` },
  ],
});

const pageShell = (eyebrow: string, title: string, description: string, details: string[]) => `
  <main class="mx-auto max-w-6xl px-4 py-10 sm:px-6" data-seo-fallback>
    <nav aria-label="Хлебные крошки"><a href="/">Yago</a> · <a href="/tools">Бесплатные инструменты</a></nav>
    <article>
      <p>${eyebrow}</p>
      <h1>${title}</h1>
      <p>${description}</p>
      <ul>${details.map((item) => `<li>${item}</li>`).join('')}</ul>
      <p><a href="#become-client">Попробовать Yago бесплатно 14 дней</a></p>
    </article>
  </main>`;

const pages: Record<string, SeoPage> = {
  '/': {
    title: 'Yago — облачная POS-система и учёт для кофейни',
    description:
      'POS-система для кофейни: касса, меню, техкарты, склад, себестоимость, аналитика и лояльность. Работает с Эвотором и АТОЛ. 14 дней бесплатно.',
    keywords: 'POS система для кофейни, программа для кофейни, касса для кафе, учет в кофейне, Эвотор, АТОЛ',
    canonicalPath: '/',
    schema: [
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Yago App',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web, Android, iOS',
        description: 'Облачная POS-система, складской учёт и лояльность для кофеен и небольших кафе.',
        url: `${SITE_URL}/`,
        inLanguage: 'ru-RU',
        offers: [
          { '@type': 'Offer', price: '2050', priceCurrency: 'RUB', category: 'Месячная подписка' },
          { '@type': 'Offer', price: '20500', priceCurrency: 'RUB', category: 'Годовая подписка' },
        ],
        provider: { '@type': 'Organization', name: 'ООО «Джемьюн»', url: `${SITE_URL}/` },
      },
    ],
    fallbackHtml: pageShell(
      'POS и учёт для независимых кофеен',
      'POS-система для кофейни: продажи, склад и лояльность',
      'Касса, техкарты, себестоимость, остатки, аналитика и программа лояльности в одном облачном сервисе.',
      ['Работает с кассами Эвотор и АТОЛ', 'Складской учёт и инвентаризация', '14 дней бесплатно']
    ),
  },
  '/tools': {
    title: 'Бесплатные инструменты для кофейни и кафе — Yago',
    description:
      'Бесплатные онлайн-инструменты для владельцев кофеен: калькуляторы, генератор техкарт в PDF и ABC/XYZ-анализ меню. Без регистрации.',
    keywords: 'инструменты для кофейни, генератор технологических карт, ABC XYZ анализ меню, калькуляторы для кафе',
    canonicalPath: '/tools',
    schema: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Бесплатные инструменты для владельцев кофеен',
        url: `${SITE_URL}/tools`,
        inLanguage: 'ru-RU',
      },
    ],
    fallbackHtml: pageShell(
      'Инструменты Yago',
      'Бесплатные инструменты для кофейни',
      'Рассчитайте экономику, создайте техкарту и проанализируйте меню прямо в браузере — без регистрации и передачи исходных данных.',
      ['Калькуляторы экономики кофейни', 'Генератор технологических карт в PDF', 'ABC/XYZ-анализ ассортимента']
    ),
  },
  '/tools/drink-cost-calculator': {
    title: 'Калькулятор себестоимости напитка и кофе онлайн — бесплатно',
    description:
      'Рассчитайте стоимость ингредиентов, упаковки, фудкост, маржу и рекомендуемую цену кофе или другого напитка.',
    keywords: 'калькулятор себестоимости напитка, себестоимость кофе, фудкост кофе, калькуляция напитка',
    canonicalPath: '/tools/drink-cost-calculator',
    schema: [
      toolSchema('Калькулятор себестоимости напитков', 'Бесплатный расчёт себестоимости, фудкоста и цены напитка.', '/tools/drink-cost-calculator'),
      breadcrumbSchema('Себестоимость напитка', '/tools/drink-cost-calculator'),
    ],
    fallbackHtml: pageShell(
      'Техкарта напитка',
      'Калькулятор себестоимости напитков',
      'Добавьте закупочные цены и нормы ингредиентов, чтобы узнать себестоимость порции, фудкост и рекомендуемую цену.',
      ['Стоимость ингредиента = цена упаковки ÷ объём × норма рецепта', 'Учитывает потери, упаковку и другие переменные расходы', 'Бесплатно и без регистрации']
    ),
  },
  '/tools/break-even-calculator': {
    title: 'Калькулятор точки безубыточности и прибыли кофейни',
    description:
      'Узнайте необходимую выручку и количество чеков, оцените операционную прибыль и запас финансовой прочности кофейни.',
    keywords: 'калькулятор точки безубыточности, прибыль кофейни, расчет выручки кафе, экономика кофейни',
    canonicalPath: '/tools/break-even-calculator',
    schema: [
      toolSchema('Калькулятор прибыли и точки безубыточности', 'Бесплатный расчёт выручки, прибыли и безубыточности кофейни.', '/tools/break-even-calculator'),
      breadcrumbSchema('Прибыль и безубыточность', '/tools/break-even-calculator'),
    ],
    fallbackHtml: pageShell(
      'Финансовая модель',
      'Калькулятор прибыли и точки безубыточности',
      'Введите средний чек, поток гостей и расходы, чтобы узнать необходимую выручку и количество чеков для выхода в ноль.',
      ['Рассчитывает маржинальный доход', 'Показывает прибыль и запас финансовой прочности', 'Строит цель по выручке и чекам']
    ),
  },
  '/tools/coffee-shop-opening-calculator': {
    title: 'Калькулятор открытия кофейни: бюджет и окупаемость',
    description:
      'Соберите стартовый бюджет кофейни, резерв оборотных средств и оцените прогнозную прибыль и срок окупаемости.',
    keywords: 'калькулятор открытия кофейни, сколько стоит открыть кофейню, бизнес план кофейни, окупаемость кофейни',
    canonicalPath: '/tools/coffee-shop-opening-calculator',
    schema: [
      toolSchema('Калькулятор открытия кофейни', 'Бесплатный расчёт бюджета запуска, оборотного резерва и окупаемости кофейни.', '/tools/coffee-shop-opening-calculator'),
      breadcrumbSchema('Бюджет открытия кофейни', '/tools/coffee-shop-opening-calculator'),
    ],
    fallbackHtml: pageShell(
      'Бюджет запуска',
      'Калькулятор открытия кофейни',
      'Соберите смету оборудования, ремонта и запуска, добавьте оборотный резерв и оцените месячную прибыль и окупаемость.',
      ['Три стартовых сценария формата', 'Полный бюджет с резервом', 'Прогноз прибыли, безубыточности и окупаемости']
    ),
  },
  '/tools/recipe-card-generator': {
    title: 'Генератор технологических карт с размерами — PDF бесплатно',
    description:
      'Создайте одностраничную техкарту для нескольких размеров с общей технологией, себестоимостью, логотипом и фото, затем скачайте PDF.',
    keywords: 'генератор технологических карт, техкарта блюда онлайн, техкарта разных размеров, технологическая карта напитка, скачать техкарту PDF',
    canonicalPath: '/tools/recipe-card-generator',
    schema: [
      toolSchema('Генератор технологических карт для кофейни', 'Бесплатное создание одностраничной технологической карты для нескольких размеров с экспортом в PDF.', '/tools/recipe-card-generator'),
      breadcrumbSchema('Генератор техкарт', '/tools/recipe-card-generator'),
    ],
    fallbackHtml: pageShell(
      'Документы кухни',
      'Генератор технологических карт для кофейни',
      'Объедините несколько размеров продукта в одной техкарте, добавьте логотип, фото и фирменный цвет, затем скачайте компактный PDF на одном листе.',
      ['До четырёх размеров с разными нормами закладки', 'Общая технология для всех размеров', 'Одностраничный PDF с логотипом и фото']
    ),
  },
  '/tools/abc-xyz-analysis': {
    title: 'ABC/XYZ-анализ ассортимента и меню онлайн — бесплатно',
    description:
      'Разделите позиции меню по вкладу в выручку и стабильности спроса, найдите лидеров, нестабильные товары и кандидатов на пересмотр.',
    keywords: 'ABC XYZ анализ ассортимента, ABC анализ меню, XYZ анализ продаж, матрица ABC XYZ онлайн',
    canonicalPath: '/tools/abc-xyz-analysis',
    schema: [
      toolSchema('ABC/XYZ-анализ ассортимента кофейни', 'Бесплатный анализ вклада позиций меню и стабильности спроса по трём периодам.', '/tools/abc-xyz-analysis'),
      breadcrumbSchema('ABC/XYZ-анализ меню', '/tools/abc-xyz-analysis'),
    ],
    fallbackHtml: pageShell(
      'Аналитика меню',
      'ABC/XYZ-анализ ассортимента кофейни',
      'Введите выручку или валовую прибыль за три периода и получите сегменты меню с практическими рекомендациями.',
      ['ABC по накопленной доле 80/15/5', 'XYZ по коэффициенту вариации спроса', 'Матрица из девяти сегментов и рекомендации']
    ),
  },
};

const normalizePath = (requestPath: string) => {
  if (requestPath === '/') return '/';
  return requestPath.replace(/\/+$/, '') || '/';
};

const escapeAttribute = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const isSeoMarketingPath = (requestPath: string) => Boolean(pages[normalizePath(requestPath)]);

const privateAppPrefixes = ['/admin', '/pos', '/kds', '/oss', '/settings', '/super-admin', '/login'];

export const isPrivateAppPath = (requestPath: string) =>
  privateAppPrefixes.some((prefix) => requestPath === prefix || requestPath.startsWith(`${prefix}/`));

export const renderNoIndexDocument = (indexHtml: string): string =>
  indexHtml
    .replace(/<html\s+lang="[^"]*"/i, '<html lang="ru"')
    .replace(/<title>[\s\S]*?<\/title>/i, '<title>Yago App — личный кабинет</title>')
    .replace(/\s*<meta[^>]+name="(?:robots|yandex)"[^>]*\/>/gi, '')
    .replace(/\s*<link[^>]+rel="canonical"[^>]*\/>/gi, '')
    .replace('</head>', '<meta name="robots" content="noindex, nofollow, noarchive" /></head>');

export const renderSeoDocument = (indexHtml: string, requestPath: string): string => {
  const page = pages[normalizePath(requestPath)];
  if (!page) return indexHtml;

  const canonicalUrl = `${SITE_URL}${page.canonicalPath === '/' ? '/' : page.canonicalPath}`;
  const managedHead = `
    <meta name="description" content="${escapeAttribute(page.description)}" />
    <meta name="keywords" content="${escapeAttribute(page.keywords)}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <meta name="yandex" content="index, follow" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:locale" content="ru_RU" />
    <meta property="og:type" content="${page.type ?? 'website'}" />
    <meta property="og:site_name" content="Yago App" />
    <meta property="og:title" content="${escapeAttribute(page.title)}" />
    <meta property="og:description" content="${escapeAttribute(page.description)}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeAttribute(page.title)}" />
    <meta name="twitter:description" content="${escapeAttribute(page.description)}" />
    ${page.schema.map((schema) => `<script type="application/ld+json" data-yago-schema>${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`).join('\n')}
  `;

  return indexHtml
    .replace(/<html\s+lang="[^"]*"/i, '<html lang="ru"')
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${page.title}</title>`)
    .replace(/\s*<meta[^>]+name="(?:description|keywords|robots|yandex|twitter:[^"]+)"[^>]*\/>/gi, '')
    .replace(/\s*<meta[^>]+property="og:[^"]+"[^>]*\/>/gi, '')
    .replace(/\s*<link[^>]+rel="canonical"[^>]*\/>/gi, '')
    .replace('</head>', `${managedHead}</head>`)
    .replace('<div id="root" class="h-full"></div>', `<div id="root" class="h-full">${page.fallbackHtml}</div>`);
};
