# kassy-deploy

Калькулятор экономики касс самообслуживания (Альфа-Банк): SVG-лендинг, 5 шагов калькулятора, письмо с расчётом и лог заявок.

Прод: **Vercel** (`*.vercel.app`) + **Turso** (постоянная SQLite в облаке) + SMTP.

Репозиторий: [github.com/Axer-me/kassy-deploy](https://github.com/Axer-me/kassy-deploy)

---

## Что внутри

| Путь | Назначение |
|------|------------|
| `index.html` | Лендинг и калькулятор |
| `assets/` | SVG и картинки |
| `kassa-email-server/` | Express: SMTP, запись заявок |
| `api/index.js` | Точка входа API на Vercel |
| `vercel.json` | Сборка статики и маршруты `/api` |
| `kassa-email-server/.env.example` | Шаблон секретов (**не** коммитить `.env`) |

Форма: `POST /api/send-calculation`  
Статистика заявок: `GET /api/submissions` (последние 200)

---

## Локальный запуск

Нужны Node.js 22 и SMTP (пароль приложения Gmail/Yandex).

```powershell
cd kassa-email-server
npm install
copy .env.example .env
```

Заполните в `.env` хотя бы SMTP. Без Turso заявки пишутся в локальный файл `submissions.db`.

Из корня репозитория или из `kassa-email-server/`:

```powershell
npm start
```

Откройте http://localhost:3456/

На телефоне в той же Wi‑Fi:

```powershell
$env:HOST="0.0.0.0"; npm start
```

Дальше `http://IP_КОМПЬЮТЕРА:3456/` (`ipconfig`).

---

## Деплой: Vercel + Turso

Секреты только в панелях Turso/Vercel, не в git.

### 1. Turso

1. Регистрация: [turso.tech](https://turso.tech)
2. Create Database, например `kassy-submissions` (регион в Европе, если есть).
3. Скопируйте **URL** (`libsql://….turso.io`) и **Auth token**.

Таблица `form_submissions` создаётся сама при первом запросе.

CLI (если установлен):

```bash
turso db create kassy-submissions
turso db show kassy-submissions --url
turso db tokens create kassy-submissions
```

### 2. GitHub

Этот репозиторий уже на GitHub. Дальше достаточно `git push`.

### 3. Vercel

1. [vercel.com/new](https://vercel.com/new) → Import `Axer-me/kassy-deploy`.
2. Root Directory **не** ставить `kassa-email-server` — корень репозитория.
3. Environment Variables **до** первого Deploy:

| Переменная | Пример |
|------------|--------|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | почта |
| `SMTP_PASS` | пароль приложения |
| `SMTP_FROM` | `Альфа-Банк <почта>` |
| `TURSO_DATABASE_URL` | `libsql://….turso.io` |
| `TURSO_AUTH_TOKEN` | токен Turso |

4. Deploy → ссылка вида `https://kassy-deploy.vercel.app`.

Если переменные добавили после деплоя — Redeploy.

Без `TURSO_*` сборка/старт на Vercel упадёт: на serverless нет постоянного диска.

### 4. Проверка

1. Открыть `https://….vercel.app`.
2. Пройти калькулятор, отправить форму на свой email (проверить «Спам»).
3. `https://….vercel.app/api/submissions` — заявка в JSON.
4. Подождать 15–20 минут и открыть `/api/submissions` снова — строка должна остаться (Turso).

Из России `*.vercel.app` часто открывается без VPN. Свой `.ru`, повешенный на DNS Vercel, часто режется. Панели Vercel/Turso с ПК в РФ могут требовать обход — на работу ссылки для заказчика это не влияет.

---

## SMTP

Нужен **пароль приложения**, не пароль от почты.

**Yandex:** IMAP/SMTP в настройках почты + [пароль приложения](https://id.yandex.ru/security/app-passwords). Хост `smtp.yandex.ru`, порт 465.

**Gmail:** 2FA + [пароль приложения](https://myaccount.google.com/apppasswords). Хост `smtp.gmail.com`, порт 465.

---

## Расчёт

- **Покупка:** (КСО + допы) × количество + сервис 4 000 ₽/мес × срок
- **Подписка:** тариф × количество × месяцы
- **В обороте:** покупка − первый месячный платёж по подписке
- **Экономия за период:** покупка − подписка

Расчёт информационный, не оферта.

---

## Частые ошибки

| Симптом | Что проверить |
|---------|----------------|
| «Не задана переменная SMTP_*» / Turso | `.env` локально или Environment Variables на Vercel + Redeploy |
| `535` / Invalid login | пароль приложения, хост совпадает с провайдером |
| Форма ошибка, письма нет | логи Deployment на Vercel, `TURSO_*` |
| Письма нет, заявка в `/api/submissions` есть | «Спам»; SMTP с IP Vercel |
| Сайт 404 на Vercel | Root Directory должен быть пустой |
| Локально форма не уходит | открывать `http://localhost:3456/`, не `file://` |
