# Frontend atomic rollout playbook

## Цель
Избежать ситуации, когда часть инстансов отдает старый `index.html`, а часть — новый набор `/assets/*`, из-за чего возникает эффект «то работает, то нет».

## 0) Режим стабилизации инцидента
- До закрытия инцидента: **никаких новых фич** (только фикс/стабилизация и безопасные выкладки).
- Во фронтенде `registerServiceWorker()` должен оставаться выключенным.
- На сервере `/service-worker.js` должен возвращать `404` (чтобы исключить повторную установку рабочего SW).

## 0.1) Рекомендуемый nginx cache policy
```nginx
location = / {
  add_header Cache-Control "no-store, no-cache, must-revalidate" always;
  try_files /index.html =404;
}

location = /index.html {
  add_header Cache-Control "no-store, no-cache, must-revalidate" always;
}

location ^~ /assets/ {
  add_header Cache-Control "public, max-age=31536000, immutable" always;
  try_files $uri =404;
}
```

## 1) Предпроверка консистентности релиза
Запустить проверку 20 запросов:

```bash
./scripts/frontend_release_check.sh https://yago-app.ru/ 20
```

Если выводит `STATUS: MISMATCH`, в проде одновременно живут разные версии фронта.

## 2) Подготовка релиза (артефакты)
Для нового релиза обязательно публиковать **полный комплект**:
- `index.html`
- весь каталог `/assets/*` этого же build-хеша

Рекомендация: хранить релиз в отдельной директории, например `/releases/<release-id>/dist`.

## 3) Atomic rollout по всем нодам

1. **Drain трафика** с ноды/группы нод (или перевести их в not-ready).
2. Скопировать на ноду полный релиз в новую директорию `/releases/<release-id>/dist`.
3. Переключить симлинк `current` атомарно:
   ```bash
   ln -sfn /releases/<release-id>/dist /srv/yago/frontend-current
   ```
4. Перезапустить процесс/контейнер (если нужно) с `FRONTEND_DIST_PATH=/srv/yago/frontend-current`.
5. Вернуть ноду в трафик.
6. Повторить для всех нод.

> Важно: не обновляйте сначала только `index.html` или только `assets` на части нод — это и создает расхождение хешей.

## 4) Технический контроль версии
Сервер добавляет заголовки `X-Release-Id` и `X-Build-Hash` для `GET /`.
Значение берется из `index.html` (`/assets/index-<hash>.js`).

Это позволяет сразу видеть, с какого релиза пришел ответ в балансировке.

## 5) Постпроверка после выравнивания
Снова выполнить:

```bash
./scripts/frontend_release_check.sh https://yago-app.ru/ 20
```

Ожидаемый результат:
- один `index-<hash>.js` во всех 20 ответах;
- один `X-Release-Id` (или `X-Build-Hash`) во всех 20 ответах;
- `STATUS: OK`.

## 6) Ручная проверка на проблемных iPad (после выкладки)
На 2–3 проблемных устройствах:
1. Принудительно очистить данные сайта (Safari Website Data).
2. Открыть `/`.
3. Выполнить логин.
4. Перейти в `/pos`.
5. Сделать 3 последовательных refresh.

Ожидание: каждый refresh стабильно грузит `/pos`/dashboard без ошибки Safari.

## 7) Критерий закрытия инцидента
- 0 ошибок вида «Safari не удалось открыть страницу».
- Стабильная загрузка `/pos` и dashboard при refresh после очистки данных сайта.
