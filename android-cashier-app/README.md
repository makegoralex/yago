# Yago Cashier Android App

Новый Android-проект для планшетов кассира, не связанный с Эвотор.

## Что перенесено из `/pos`

- Приложение запускает только кассовый контур (`/pos`) во встроенном WebView.
- Доступ к `/admin` и `/super-admin` в приложении блокируется и перенаправляется обратно в `/pos`.
- Сверху добавлена простая панель действий для кассира: переход в POS, обновление и выход.
- Выход очищает localStorage/sessionStorage + cookies, затем открывает `/login`.

## Конфигурация

Базовый URL задается в `app/build.gradle.kts` через `BuildConfig.BASE_URL`.

```kotlin
buildConfigField("String", "BASE_URL", "\"https://app.yago.ru\"")
```

Для локальной разработки можно заменить на ваш стенд (например, `http://10.0.2.2:5173`).

## Запуск

```bash
cd android-cashier-app
./gradlew assembleDebug
```

> Если в окружении нет `gradle-wrapper.jar`, запустите через установленный Gradle (`gradle assembleDebug`) или добавьте wrapper (`gradle wrapper`).
