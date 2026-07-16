import { isPrivateAppPath, isSeoMarketingPath, renderNoIndexDocument, renderSeoDocument } from '../seoPages';

const indexHtml = `<!doctype html>
<html lang="en"><head>
<meta name="description" content="default" />
<meta name="robots" content="index" />
<link rel="canonical" href="https://yago-app.ru/" />
<meta property="og:title" content="default" />
<meta name="twitter:title" content="default" />
<title>Yago App</title>
</head><body><div id="root" class="h-full"></div></body></html>`;

describe('SEO marketing pages', () => {
  it('recognizes tool pages with or without a trailing slash', () => {
    expect(isSeoMarketingPath('/tools')).toBe(true);
    expect(isSeoMarketingPath('/tools/drink-cost-calculator/')).toBe(true);
    expect(isSeoMarketingPath('/tools/recipe-card-generator')).toBe(true);
    expect(isSeoMarketingPath('/tools/abc-xyz-analysis/')).toBe(true);
    expect(isSeoMarketingPath('/pos')).toBe(false);
  });

  it('renders server-visible SEO for the new tools', () => {
    const recipeHtml = renderSeoDocument(indexHtml, '/tools/recipe-card-generator');
    const analysisHtml = renderSeoDocument(indexHtml, '/tools/abc-xyz-analysis');

    expect(recipeHtml).toContain('<title>Генератор технологических карт с размерами — PDF бесплатно</title>');
    expect(recipeHtml).toContain('<h1>Генератор технологических карт для кофейни</h1>');
    expect(recipeHtml).toContain('rel="canonical" href="https://yago-app.ru/tools/recipe-card-generator"');
    expect(analysisHtml).toContain('<title>ABC/XYZ-анализ ассортимента и меню онлайн — бесплатно</title>');
    expect(analysisHtml).toContain('<h1>ABC/XYZ-анализ ассортимента кофейни</h1>');
    expect(analysisHtml).toContain('rel="canonical" href="https://yago-app.ru/tools/abc-xyz-analysis"');
  });

  it('renders unique server-visible metadata and semantic fallback content', () => {
    const html = renderSeoDocument(indexHtml, '/tools/break-even-calculator');

    expect(html).toContain('<html lang="ru">');
    expect(html).toContain('<title>Калькулятор точки безубыточности и прибыли кофейни</title>');
    expect(html).toContain('rel="canonical" href="https://yago-app.ru/tools/break-even-calculator"');
    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain('<h1>Калькулятор прибыли и точки безубыточности</h1>');
    expect(html.match(/name="description"/g)).toHaveLength(1);
    expect(html.match(/property="og:title"/g)).toHaveLength(1);
  });

  it('marks application routes as noindex', () => {
    expect(isPrivateAppPath('/pos')).toBe(true);
    expect(isPrivateAppPath('/admin/organization')).toBe(true);
    expect(isPrivateAppPath('/tools')).toBe(false);

    const html = renderNoIndexDocument(indexHtml);
    expect(html).toContain('content="noindex, nofollow, noarchive"');
    expect(html.match(/name="robots"/g)).toHaveLength(1);
  });
});
