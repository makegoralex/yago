# Evotor: быстрый чек-лист подключения

Этот чек-лист нужен, чтобы **без базы** проверить, что Evotor прислал токен и устройство зарегистрировано.

## 1) Переменные окружения на сервере

Добавьте в `.env`:

```
EVOTOR_APP_UUID=c2c3cb64-70d6-4d54-9450-0a4efd302ea3
EVOTOR_PUBLISHER_TOKEN=<ваш ключ издателя>
EVOTOR_WEBHOOK_SECRET=<ваш секрет из кабинета или пусто>
```

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
