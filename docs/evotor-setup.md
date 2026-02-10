# Evotor: быстрый чек-лист подключения

Этот чек-лист нужен, чтобы **без базы** проверить, что Evotor прислал токен и устройство зарегистрировано.

## 1) Переменные окружения на сервере

Добавьте в `.env`:

```
EVOTOR_APP_UUID=c2c3cb64-70d6-4d54-9450-0a4efd302ea3
EVOTOR_PUBLISHER_TOKEN=<ваш ключ издателя>
EVOTOR_WEBHOOK_SECRET=<ваш секрет из кабинета или пусто>
EVOTOR_WEBHOOK_DEBUG=true
```

- `EVOTOR_WEBHOOK_DEBUG=true` включает детальные логи входящих webhook-запросов.
- Чтобы отключить детальные логи после диагностики, поставьте `EVOTOR_WEBHOOK_DEBUG=false`.

Перезапустите backend.

## 2) Настройка webhook в кабинете Evotor

- URL: `https://yago-app.ru/api/evotor/token`
- Метод: `POST`
- Тип авторизации: **Ваш токен**
- Токен: такой же как `EVOTOR_WEBHOOK_SECRET` (или пусто, если не используете)

Включите галку **«Токен приложения для доступа к REST API Эвотор»**.

## 3) Установка APK на терминал

После установки Evotor отправит webhook → backend сохранит устройство.

## 4) Проверка без базы

Зайдите в Postman (или curl) и выполните:

```
GET https://yago-app.ru/api/evotor/status
Authorization: Bearer <ваш accessToken администратора>
```

В ответе будет список устройств, которые прислал Evotor.

Если `deviceCount > 0` — связка работает ✅

## 5) Привязка устройства к организации

```
POST https://yago-app.ru/api/evotor/devices/link
Authorization: Bearer <ваш accessToken администратора>

{
  "deviceUuid": "<uuid устройства>",
  "registerId": "<id кассы (опционально)>"
}
```

После этого backend сможет слать push на терминал.

## 6) Как посмотреть, что именно пришло в POST /api/evotor/token

### 6.1 Включите debug и перезапустите API

```bash
pm2 restart yago-api --update-env
```

### 6.2 Откройте логи и держите их в реальном времени

```bash
pm2 logs yago-api --lines 200
```

Ищите строки:
- `[evotor][token] webhook payload received`
- `[evotor][token] webhook saved`
- `[evotor][token] unauthorized webhook request`

### 6.3 Переустановите приложение на терминале

Webhook обычно приходит во время установки/первой активации. Если приложение уже установлено, повторный POST может не прийти, поэтому сделайте:
1. удалить приложение на тестовом терминале,
2. установить заново,
3. смотреть логи в этот момент.

### 6.4 Что проверять в логах

В `webhook payload received` проверьте:
- `authorization` (маскируется в логах),
- `payload.user.id` **или** `payload.userId` / `payload.userUuid`,
- `payload.device_uuid`,
- `payload.store_uuid`,
- `payload.token` (маскируется в логах).

Если Evotor присылает идентификатор пользователя не во вложенном `user.id`,
backend также поддерживает плоские поля `userId`, `user_id`, `userUuid`,
`user_uuid`.

В `webhook saved` проверьте:
- `id` записи,
- `userId`, `deviceUuid`, `storeUuid`.

Если видите `unauthorized webhook request`, значит токен из кабинета Evotor не совпадает с `EVOTOR_WEBHOOK_SECRET` на сервере.

### 6.5 Быстрая проверка, что endpoint вообще доступен

```bash
curl -i https://yago-app.ru/api/evotor/token
```

Для `GET` там может быть `404`/`405` — это нормально. Важно, что домен и путь доступны извне.

### 6.6 Проверка после webhook

После срабатывания webhook проверьте:

```bash
curl -sS https://yago-app.ru/api/evotor/status -H "Authorization: Bearer <ADMIN_ACCESS_TOKEN>"
```

Если `deviceCount > 0`, webhook не только пришёл, но и корректно сохранился в БД.
