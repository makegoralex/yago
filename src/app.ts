import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import swaggerUi from 'swagger-ui-express';

import { authMiddleware } from './middleware/auth';
import { authRouter } from './routes/auth';
import catalogRouter from './modules/catalog/catalog.router';
import { buildSwaggerDocument } from './swagger';
import orderRouter from './modules/orders/order.router';
import customersRouter from './modules/customers/customer.router';
import loyaltyRouter from './modules/loyalty/loyalty.router';
import reportsRouter from './routes/reports';
import adminManagementRouter from './routes/adminManagement';
import suppliersRouter from './modules/suppliers/supplier.router';
import inventoryRouter from './modules/inventory/inventory.router';
import discountRouter, { createPosDiscountRouter } from './modules/discounts/discount.router';
import { appConfig } from './config/env';
import shiftRouter from './modules/shifts/shift.router';
import restaurantSettingsRouter from './modules/restaurant/restaurantSettings.router';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const posDiscountRouter = createPosDiscountRouter();

app.get('/', (_req, res) => {
  res.type('html').send(`
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Yago POS — платформа для современной торговли</title>
        <style>
          :root {
            --bg: #0b1221;
            --card: #111a2f;
            --accent: #5ad0ff;
            --text: #e8f0ff;
            --muted: #b7c4e3;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: radial-gradient(circle at 10% 20%, rgba(90, 208, 255, 0.08), transparent 25%),
              radial-gradient(circle at 80% 0%, rgba(160, 120, 255, 0.12), transparent 32%),
              var(--bg);
            color: var(--text);
            min-height: 100vh;
          }

          header {
            max-width: 1100px;
            margin: 0 auto;
            padding: 48px 24px 24px;
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 20px;
            justify-content: space-between;
          }

          .logo {
            display: inline-flex;
            align-items: center;
            gap: 12px;
            font-weight: 800;
            font-size: 20px;
            letter-spacing: 0.3px;
          }

          .logo-mark {
            width: 42px;
            height: 42px;
            border-radius: 12px;
            background: linear-gradient(135deg, #5ad0ff, #7c7cff);
            display: grid;
            place-items: center;
            font-size: 24px;
            color: #0b1221;
            font-weight: 900;
          }

          .cta-button {
            padding: 12px 18px;
            border-radius: 12px;
            border: 1px solid rgba(90, 208, 255, 0.5);
            background: linear-gradient(120deg, rgba(90, 208, 255, 0.25), rgba(124, 124, 255, 0.2));
            color: var(--text);
            font-weight: 700;
            text-decoration: none;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
          }

          .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 38px rgba(90, 208, 255, 0.25);
          }

          main {
            max-width: 1100px;
            margin: 0 auto;
            padding: 0 24px 48px;
          }

          .hero {
            background: linear-gradient(180deg, rgba(17, 26, 47, 0.92), rgba(17, 26, 47, 0.7));
            border: 1px solid rgba(90, 208, 255, 0.18);
            border-radius: 24px;
            padding: 36px;
            box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
            display: grid;
            gap: 18px;
          }

          .hero h1 {
            margin: 0;
            font-size: clamp(28px, 5vw, 38px);
            line-height: 1.2;
          }

          .hero p {
            margin: 0;
            color: var(--muted);
            font-size: 16px;
            line-height: 1.6;
          }

          .metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 14px;
          }

          .metric-card {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(90, 208, 255, 0.18);
            border-radius: 18px;
            padding: 16px;
          }

          .metric-card .value {
            font-size: 24px;
            font-weight: 800;
          }

          .metric-card .label {
            color: var(--muted);
            font-size: 13px;
            letter-spacing: 0.3px;
          }

          .section-title {
            margin: 38px 0 12px;
            font-size: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .section-title::before {
            content: '';
            width: 12px;
            height: 12px;
            border-radius: 4px;
            background: linear-gradient(135deg, #5ad0ff, #7c7cff);
            box-shadow: 0 0 16px rgba(90, 208, 255, 0.5);
          }

          .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 14px;
          }

          .feature-card {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 16px;
            padding: 18px;
            display: grid;
            gap: 8px;
          }

          .feature-card strong {
            font-size: 16px;
          }

          .feature-card span {
            color: var(--muted);
            font-size: 14px;
            line-height: 1.5;
          }

          .footer-note {
            margin-top: 36px;
            color: var(--muted);
            font-size: 13px;
          }
        </style>
      </head>
      <body>
        <header>
          <div class="logo" aria-label="Логотип Yago POS">
            <div class="logo-mark">Y</div>
            <div>Yago POS</div>
          </div>
          <a class="cta-button" href="mailto:hello@yagopos.com">Запросить демо</a>
        </header>
        <main>
          <section class="hero">
            <h1>Ваш бизнес под контролем: POS, склад, лояльность и аналитика в одном окне</h1>
            <p>
              Yago POS — облачная платформа для кафе, магазинов и dark kitchen. Управляйте сменами, меню, скидками и заказами
              без сложных интеграций, а встроенные API позволяют подключать витрины и внешние сервисы.
            </p>
            <div class="metrics">
              <div class="metric-card">
                <div class="value"><span aria-hidden="true">⚡</span> 5 минут</div>
                <div class="label">На развёртывание и запуск точки</div>
              </div>
              <div class="metric-card">
                <div class="value">99.9%</div>
                <div class="label">Доступность облачной инфраструктуры</div>
              </div>
              <div class="metric-card">
                <div class="value">API Ready</div>
                <div class="label">REST + документация на /docs</div>
              </div>
            </div>
          </section>

          <h2 class="section-title">Что уже внутри</h2>
          <div class="features" role="list">
            <div class="feature-card" role="listitem">
              <strong>Управление меню и каталогом</strong>
              <span>Категории, модификаторы, остатки и цены с мгновенным обновлением на POS и курьерских витринах.</span>
            </div>
            <div class="feature-card" role="listitem">
              <strong>Заказы и скидки</strong>
              <span>Гибкие правила промо, промокоды, автоматические скидки по времени и персональные предложения.</span>
            </div>
            <div class="feature-card" role="listitem">
              <strong>Склад и поставщики</strong>
              <span>Остатки, инвентаризации, приходные накладные и контроль себестоимости по каждому блюду.</span>
            </div>
            <div class="feature-card" role="listitem">
              <strong>Лояльность и клиенты</strong>
              <span>Баллы, статусы, персональные цены и история покупок в одном профиле гостя.</span>
            </div>
            <div class="feature-card" role="listitem">
              <strong>Смены и кассы</strong>
              <span>Открытие/закрытие смен, кассовая дисциплина и контроль движения наличных.</span>
            </div>
            <div class="feature-card" role="listitem">
              <strong>Отчётность</strong>
              <span>Продажи по часам и категориям, эффективность акций, маржинальность и экспорт данных.</span>
            </div>
          </div>

          <h2 class="section-title">Подключение за день</h2>
          <div class="features" role="list">
            <div class="feature-card" role="listitem">
              <strong>Облачный старт</strong>
              <span>Не требуется своё железо: достаточно браузера или планшета. POS доступен на /pos.</span>
            </div>
            <div class="feature-card" role="listitem">
              <strong>Админ-панель</strong>
              <span>Настройка меню, скидок и пользователей на /admin с ролевой моделью доступа.</span>
            </div>
            <div class="feature-card" role="listitem">
              <strong>Интеграции по API</strong>
              <span>Документация по адресу /docs. Используйте webhooks и REST, чтобы связать доставку и CRM.</span>
            </div>
          </div>

          <p class="footer-note">Готовы попробовать? Напишите нам — подключим пилот за один день и перенесём ваши данные.</p>
        </main>
      </body>
    </html>
  `);
});

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/catalog', catalogRouter);
app.use('/api/orders/discounts', posDiscountRouter);
app.use('/api/orders', orderRouter);
app.use('/api/customers', customersRouter);
app.use('/api/loyalty', loyaltyRouter);
app.use('/api/discounts', discountRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/admin', adminManagementRouter);
app.use('/api/shifts', shiftRouter);
app.use('/api/restaurant', restaurantSettingsRouter);

app.get('/api/protected', authMiddleware, (req, res) => {
  res.json({
    message: 'Protected resource access granted',
    user: req.user,
  });
});

const swaggerDocument = buildSwaggerDocument();
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const frontendCandidates = [
  appConfig.frontendDistPath,
  path.resolve(__dirname, '..', 'frontend', 'dist'),
  path.resolve(__dirname, '..', 'frontend-dist'),
  path.resolve(__dirname, 'public'),
].filter(Boolean) as string[];

const resolveExistingBundle = (candidates: string[]): string | undefined => {
  for (const candidate of candidates) {
    try {
      const stats = fs.statSync(candidate);
      if (!stats.isDirectory()) {
        continue;
      }

      const htmlPath = path.join(candidate, 'index.html');
      if (fs.existsSync(htmlPath)) {
        return candidate;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('Failed to inspect frontend bundle path:', candidate, error);
      }
    }
  }

  return undefined;
};

let frontendDistPath = resolveExistingBundle(frontendCandidates);
let frontendStaticMiddleware: express.RequestHandler | null = frontendDistPath
  ? express.static(frontendDistPath)
  : null;

const refreshFrontendBundle = (): void => {
  const maybeBundle = resolveExistingBundle(frontendCandidates);
  if (!maybeBundle) {
    if (frontendDistPath) {
      console.warn(
        'Frontend bundle became unavailable. Requests to /pos or /admin will return 404 until the bundle is rebuilt.'
      );
    }

    frontendDistPath = undefined;
    frontendStaticMiddleware = null;
    return;
  }

  if (maybeBundle !== frontendDistPath || !frontendStaticMiddleware) {
    frontendDistPath = maybeBundle;
    frontendStaticMiddleware = express.static(frontendDistPath);
  }
};

const serveFrontendStatic: express.RequestHandler = (req, res, next) => {
  if (req.path === '/') {
    return next();
  }

  if (req.path.startsWith('/api') || req.path.startsWith('/docs') || req.path.startsWith('/healthz')) {
    return next();
  }

  if (!frontendStaticMiddleware) {
    refreshFrontendBundle();
  }

  if (!frontendStaticMiddleware) {
    return next();
  }

  return frontendStaticMiddleware(req, res, (err) => {
    if (err) {
      return next(err);
    }

    return next();
  });
};

const serveSpaFallback = (req: Request, res: Response, next: NextFunction): void => {
  if (req.path.startsWith('/api/')) {
    return next();
  }

  if (req.path.startsWith('/docs') || req.path.startsWith('/healthz')) {
    return next();
  }

  if (req.path === '/') {
    return next();
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    next();
    return;
  }

  let distPath = frontendDistPath;
  if (!distPath || !fs.existsSync(path.join(distPath, 'index.html'))) {
    refreshFrontendBundle();
    distPath = frontendDistPath;
  }

  if (!distPath) {
    next();
    return;
  }

  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        frontendDistPath = undefined;
        frontendStaticMiddleware = null;
      }

      next(err);
      return;
    }
  });
};

if (!frontendDistPath) {
  console.warn(
    'PWA bundle was not found. Build the frontend (npm run build inside frontend/) and copy the dist folder next to the API or provide FRONTEND_DIST_PATH.'
  );
}

app.use(serveFrontendStatic);
app.use(serveSpaFallback);

const frontendPath = path.join(__dirname, 'frontend');
app.use(express.static(frontendPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

export default app;
