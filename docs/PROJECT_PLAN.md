Цель: спроектировать масштабируемую много-точечную POS-платформу для кофеен (и в перспективе — мульти-ресторан), с быстрым стартом (Web/PWA), автодеплоем, безопасной архитектурой и возможностью пошаговой разработки через Codex (ветки/PR).

1) Видение и scope

MVP (итерация 0–1):

Web-приложение (PWA) кассира и админки.

Мульти-точечность и мульти-тенантность: 1 аккаунт = сеть, в ней локации/кассы.

Товары/модификаторы/категории, корзина, оплата «нал/безнал», чек.

Лояльность по номеру телефона (создание/поиск гостя, скидки/баллы).

Инвентаризация: списания по рецептурам/ингредиентам.

Базовая статистика/отчёты (дневные выручки, категория/товар, кассир).

Интеграции: АТОЛ (фискализация), терминал оплаты (абстрактный драйвер).

Автодеплой GitHub Actions → VPS (PM2).

Дальше (итерации 2+):

Kiosk/терминалы самообслуживания (web kiosk).

Мобильные приложения (iOS/Android) на базе PWA/Capacitor.

Производство (кухня/цех), поставки, план-факт списаний.

Расширенная аналитика (когорты, CLV, RFM).

Роли/права, SSO, бэкап/ретеншн, аудиты.

Маркетинг: промокоды, акции, пуш/смс-кампании.

2) Технологии и инфраструктура

Backend: Node.js 18 LTS, Express, TypeScript.

DB: MongoDB (Atlas/самостоятельно) — быстрая схема для MVP; миграции через migrate-mongo.

Cache/Queue (позже): Redis (кэш справочников/сессий; очереди печати чеков).

Frontend (web): React + Vite, TypeScript, TailwindCSS, Zustand/Redux Toolkit.

PWA: оффлайн-кэш меню, сохранение черновиков чеков при обрыве сети.

CI/CD: GitHub Actions → SFTP/SSH деплой на VPS, PM2 процессы.

Рантайм: Linux (Ubuntu), Nginx (reverse proxy) + Node (порт 3000).

Логи/мониторинг: PM2 logs, Healthcheck /healthz, (позже) Loki/Prometheus/Grafana.

Фискализация: адаптер АТОЛ (REST/JSON); интерфейс драйверов.

Эквайринг: абстракция PaymentTerminalDriver (Ingenico/Альфа/Тинькофф и т. п.).

I18n/локаль: ru-RU; поддержка мультивалют (на уровне цены/налогов).

Time: сервера в UTC; в БД сохраняем UTC; фронт → локаль.

3) Архитектура (логические модули)

Core / общие:

Auth & RBAC: JWT (access+refresh), роли: owner, admin, manager, cashier, kitchen.

Tenants: organization → locations → registers (кассы).

Catalog: категории, товары, вариации, модификаторы, рецепты (ингредиенты).

Pricing & Taxes: цены, скидки, промо; налоги (ставки).

Customers (CRM-lite): профиль по телефону, история заказов, баланс/баллы.

Loyalty: правила начисления/списания баллов, купоны, персональные скидки.

Orders / POS: корзина, чек, статус заказа (draft → paid → fiscalized).

Inventory: склады/остатки, поступления, списания, авто-списание по рецепту.

Reports: x/z-отчёты, продажи по дням/часам, ABC/XYZ.

Integrations: Atol, PaymentTerminal (через интерфейсы, см. §7).

Доп. модули (после MVP):

KDS (кухонный дисплей).

Kiosk (self-order).

Production & Supplies: планирование производства, заказы поставщикам.

Accounting export: выгрузки в 1С/CSV.

4) API дизайн (REST)

База: /api/v1

Auth: POST /auth/register, POST /auth/login, POST /auth/refresh, POST /auth/invite

Tenants/locations/registers: CRUD; привязка пользователей/ролей.

Catalog: GET/POST/PUT/DELETE /catalog/* (categories, products, modifiers, recipes)

Customers/loyalty: GET /customers?phone=, POST /loyalty/earn, POST /loyalty/redeem

Orders/POS:

POST /orders (draft), PUT /orders/:id/items,

POST /orders/:id/pay (method = cash/card/loyalty),

POST /orders/:id/fiscalize (внутренний вызов адаптера),

GET /orders/:id, GET /orders?dateFrom&dateTo&status

Inventory: POST /stock/receive, POST /stock/writeoff, GET /stock/levels

Reports: GET /reports/sales-daily, GET /reports/x, GET /reports/z

Integrations: POST /integrations/atol/fiscalize, POST /integrations/terminal/pay

Стандарты:

Ответы JSON { data, error }; ошибки — Problem Details (type, title, detail, status).

Пагинация: ?limit=&offset=; сорт ?sort=field,-field.

Идемпотентность платежей/фискализации через idempotency_key.

5) Данные (упрощённые схемы)
// tenant.ts
Organization { _id, name, owners:[userId], createdAt }
Location { _id, orgId, name, address, timezone, registers:[registerId] }
Register { _id, orgId, locationId, name, code, isActive }

// user.ts
User { _id, orgId, email, phone, passwordHash, roles:[role], status }

// product.ts
Category { _id, orgId, name, sort }
Modifier { _id, orgId, name, priceDelta, type: 'single'|'multi', options:[...] }
Product {
  _id, orgId, name, sku, categoryId, price, taxRate, modifiers:[modifierId],
  recipe: [{ ingredientId, qty, unit }], isActive
}
Ingredient { _id, orgId, name, unit, costPrice, stockLevel }

// customer.ts
Customer { _id, orgId, phone, name, points, history:[orderId] }

// order.ts
Order {
  _id, orgId, locationId, registerId, cashierId, customerId?,
  items:[{ productId, name, qty, price, modifiersApplied:[...], total }],
  totals:{ subtotal, discount, tax, grandTotal },
  payments:[{ method, amount, txnId? }],
  status: 'draft'|'paid'|'fiscalized'|'cancelled',
  idempotencyKey, createdAt
}

6) Директории (монорепа с пакетами)
/apps
  /api          # Express API (Node 18, TS)
  /pos-web      # Web/PWA кассира (React)
  /admin-web    # Админка (React)
/packages
  /ui           # общий UI-kit (React)
  /core         # доменные модели/валидации/zod
  /sdk          # JS SDK для фронтов
  /drivers      # адаптеры: atol, terminals
/config
  nginx.conf
  pm2.config.js
/docs
  PROJECT_PLAN.md


API (apps/api):

src/
  index.ts (bootstrap)
  server.ts (Express app)
  modules/
    auth/
    tenants/
    catalog/
    orders/
    customers/
    loyalty/
    inventory/
    reports/
    integrations/
  shared/
    db.ts (Mongo conn)
    logger.ts
    errors.ts
    middlewares/

7) Интеграции: интерфейсы драйверов
// packages/drivers/src/AtolDriver.ts
export interface FiscalDriver {
  fiscalize(order: Order): Promise<{ fiscalDocId: string; url?: string }>;
}
export class AtolDriver implements FiscalDriver { /* REST к АТОЛ */ }

// packages/drivers/src/PaymentTerminal.ts
export interface PaymentTerminalDriver {
  pay(amount: number, currency: string, orderId: string): Promise<{ txnId: string }>;
  refund(txnId: string): Promise<void>;
}


В API используем абстракции, конкретный драйвер подставляется по ENV (feature-flag).

8) Безопасность

JWT, refresh-token rotation, httpOnly cookies (для веб).

RBAC per-route: middleware requireRole('cashier'|'admin'|…).

Tenant isolation: все запросы фильтруются по orgId.

Rate limiting (login/числовые операции).

Валидация входных данных (zod/yup).

Secrets через .env (не коммитим).

9) Конфигурация и ENV
Backend .env
NODE_ENV=production
PORT=3000
MONGO_URI=mongodb://user:pass@host:27017/yago?authSource=admin
JWT_SECRET=***
JWT_REFRESH_SECRET=***
ATOL_BASE_URL=https://...
ATOL_LOGIN=...
ATOL_PASS=...
PAYMENT_DRIVER=mock|ingenico|tinkoff

Frontend .env
VITE_API_BASE=/api/v1

10) CI/CD и ветвление

Branch protection: main — защита, merge только через PR, требовать успешный CI.

Правило работы с Codex: всегда в feature/*, затем PR → review → merge.

GitHub Actions:

build-test.yml: lint + typecheck + unit tests.

deploy.yml: деплой только при push: main.

PM2: pm2 start apps/api/dist/index.js --name api, pm2 start apps/pos-web/dist/server.js --name pos (если SSR) или отдача статикой через Nginx.

11) Качество и тесты

ESLint + Prettier + TypeScript strict.

Unit: Vitest/Jest (модули каталога, расчёт тоталов, лояльность).

Integration: Supertest (REST эндпоинты).

E2E (позже): Playwright (основные сценарии кассира).

Contracts: OpenAPI (Swagger UI на /docs).

12) План внедрения (итерации для Codex)

Итерация A (база):

feature/init-api: каркас API (Express+TS, healthcheck, auth stub).

feature/auth-rbac: JWT, роли, guards, refresh.

feature/tenants: org/location/register CRUD.

feature/catalog-core: категории/товары/модификаторы/рецепты.

feature/orders-core: корзина → заказ → оплата (mock), статусы, тоталы.

feature/loyalty-basic: клиенты, поиск по телефону, начисление/списание баллов.

feature/inventory-writeoff: авто-списание по рецептам при оплате.

feature/reports-basic: продажи по дням, x/z.

Итерация B (интеграции/UI):

feature/atol-driver: драйвер АТОЛ + фискализация.

feature/terminal-driver-mock: абстракция оплаты, мок-терминал.

feature/pos-web: экран кассира (PWA), оффлайн-кэш меню.

feature/admin-web: CRUD каталога, лояльность, отчёты.

Итерация C (расширения):

feature/kiosk-web

feature/kds

feature/production-supplies

Для каждой ветки просить Codex: создать ветку → реализовать модуль → unit-тесты → PR с описанием.

13) Нагрузочная и отказоустойчивость (после MVP)

Разнести API и Web на разные PM2 процессы.

Вынести MongoDB на управляемый кластер/реплику.

Кэшировать справочники (каталог) в Redis.

Очереди на печать чеков (если драйверы нестабильны).

14) UX-детали POS

Горячие клавиши, быстрый поиск по SKU/названию.

Быстрые модификаторы/частые товары.

Профиль клиента по телефону + баланс/история.

Быстрая смена кассиров (PIN).

Светофор статусов: создан → оплачен → фискализирован.

15) Лицензии и юридическое

Используем только OSS с совместимыми лицензиями (MIT/Apache).

Интеграции с АТОЛ/терминалами — соответствовать их SDK/лицензиям.

Персональные данные: хранить минимум, согласия/политика.
