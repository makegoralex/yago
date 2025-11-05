# Yago Repository Snapshot

This workspace was set up to track the contents of the public repository at
<https://github.com/makegoralex/yago>. Network restrictions prevented fetching
updates directly from GitHub during this session, so the snapshot reflects the
state available locally.

## Инструкции по сборке и развёртыванию

Ниже — быстрый чек-лист на русском языке, который помогает повторно собрать и
запустить проект после деплоя на сервер.

### 1. Backend (Node.js + TypeScript)

1. Скопируйте `.env.example` в `.env` и укажите значения для `PORT`, `MONGODB_URI`
   и секретов JWT.
2. Установите зависимости и соберите проект:
   ```bash
   npm install
   npm run build
   ```
3. Запустите сервис. Для локального режима достаточно `npm run dev`. Для продакшн-
   окружения используйте `npm run start`. Если приложение крутится под PM2,
   перезапускайте его командой `pm2 restart <имя-процесса> --update-env` — имя
   процесса должно совпадать с тем, что вы указали при запуске (`pm2 start dist/index.js --name yago-api`).
4. После запуска API доступен по адресу `http://<host>:<PORT>`. Корневой маршрут `/`
   возвращает текст `✅ Yago POS API is running`, что можно использовать для
   health-check.

### 2. Frontend (PWA кассового интерфейса)

1. Перейдите в директорию `frontend/` и создайте `.env` на основе `.env.example`.
   Переменная `VITE_API_URL` не обязательна — по умолчанию PWA обращается к тому
   же домену, с которого загружено приложение.
2. Установите зависимости и соберите статику:
   ```bash
   npm install
   npm run build
   ```
3. Для локальной проверки можно запустить предпросмотр `npm run preview`. В бою
   размещайте содержимое `frontend/dist` за reverse-proxy или любым другим
   web-сервером (Nginx, Caddy и т. д.).
4. После сборки интерфейс кассира доступен по `http://<host>:<порт>/pos`.

### 3. Полезные напоминания

- Если меняете конфигурацию среды, не забывайте обновить переменные окружения и
  перезапустить сервис с флагом `--update-env`, чтобы PM2 подхватил изменения.
- Swagger-документация доступна на `/docs` и помогает быстро проверить схему API
  после обновления.
- Логи PM2 можно посмотреть командой `pm2 logs <имя-процесса>`.
