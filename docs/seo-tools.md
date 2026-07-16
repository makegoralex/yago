# SEO-инструменты Yago

Публичный каталог находится на `/tools`. Каждый инструмент:

- доступен без авторизации;
- считает данные локально в браузере;
- имеет собственный URL, H1, title, description, canonical и JSON-LD;
- использует общий `ToolShell`, форму регистрации `ToolSignupCta` и блок перелинковки;
- получает карточку в каталоге и на других страницах из общего реестра.

## Структура

- `frontend/src/features/tools/toolRegistry.ts` — карточки, URL, SEO-тексты и темы.
- `frontend/src/features/tools/calculations.ts` — чистые функции расчётов.
- `frontend/src/features/tools/recipeCardPdf.ts` — локальная генерация PDF без передачи данных на сервер.
- `frontend/src/components/tools/` — общая оболочка, поля и CTA.
- `frontend/src/pages/tools/` — каталог и страницы калькуляторов.
- `src/landing/seoPages.ts` — серверные метатеги и семантический HTML для поисковых роботов.
- `frontend/public/sitemap.xml` и `frontend/public/robots.txt` — индексирование.

## Как добавить инструмент

1. Добавить описание в `toolRegistry.ts`.
2. Вынести формулы в `calculations.ts`, чтобы UI не смешивался с методикой.
3. Создать страницу в `frontend/src/pages/tools/` через `ToolShell` и `NumberField`.
4. Добавить lazy-route в `frontend/src/App.tsx`.
5. Добавить маршрут и серверный SEO-fallback в `src/landing/seoPages.ts`.
6. Добавить URL в `frontend/public/sitemap.xml`.
7. Проверить title, description, canonical, JSON-LD, единственный H1 и мобильную ширину 390 px.
8. Запустить backend/frontend TypeScript build и SEO-тест.

## Правила контента

- Один инструмент решает одну задачу и не требует аккаунта.
- Результат пересчитывается сразу после изменения поля.
- Методика и ограничения расчёта видны на странице.
- Стартовые значения явно называются примером, а не рыночной гарантией.
- CTA Yago размещается после результата и не блокирует расчёт.
- Для новых страниц используются человекочитаемые URL на английской транслитерации или устойчивом отраслевом термине.

## Индексация

Маркетинговые страницы получают серверный HTML через `renderSeoDocument`, поэтому title, description, canonical, schema.org и основной текст доступны без выполнения JavaScript. Закрытые маршруты POS и админки получают `noindex, nofollow, noarchive`.

После деплоя нужно отправить sitemap в Яндекс Вебмастер и проверить страницы инструментом «Проверка URL».
