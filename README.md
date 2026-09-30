# kassy

Калькулятор экономики касс самообслуживания (Альфа-Банк): стартовый экран, 5 экранов калькулятора, отправка расчёта на email и сохранение заявок в Supabase.

---

## Архитектура

```
Браузер  →  Vercel CDN (index.html + assets/)
         →  Vercel Serverless (api/send-calculation.js)
                ├── Nodemailer → SMTP → email клиенту
                └── Supabase  → form_submissions
```

- **Фронтенд** — один `index.html`: стартовый экран + калькулятор (5 экранов, CSS-only навигация). На экране количества касс можно ввести число с клавиатуры (на телефоне — цифровая). Интерфейс растягивается на весь экран (киоск 1920×1080, iPad, смартфон).
- **Бэкенд** — serverless-функция `api/send-calculation.js` (Vercel, Node.js).
- **БД** — Supabase (PostgreSQL), таблица `form_submissions`.
- **Локальная разработка** — `server.js` (Express), запуск из корня проекта.

---

## Быстрый старт (локально)

```bash
npm install
cp .env.example .env   # заполнить SMTP и Supabase
npm start
```

Откройте http://localhost:3456/

**iPhone / iPad** (та же Wi-Fi сеть):
```bash
# Windows PowerShell
$env:HOST="0.0.0.0"; npm start
```
Узнайте IP (`ipconfig`) и откройте в Safari `http://192.168.x.x:3456/`.

---

## Структура

| Файл / папка | Назначение |
|---|---|
| `index.html` | Стартовый экран + 5 экранов калькулятора + вся логика на клиенте |
| `assets/` | Изображение кассы на стартовом экране |
| `favicon.svg` | Логотип Альфа-Банк, иконка вкладки |
| `api/send-calculation.js` | Vercel serverless: отправка email + запись в Supabase |
| `server.js` | Express-сервер для локальной разработки |
| `.env.example` | Шаблон переменных окружения |
| `vercel.json` | Конфиг деплоя (Node.js runtime) |
| `supabase-schema.sql` | SQL для создания таблицы в Supabase |

---

## Переменные окружения

Скопируйте `.env.example` → `.env` и заполните:

```env
# SMTP (обязательно)
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your@yandex.ru
SMTP_PASS=your_app_password
SMTP_FROM=Альфа-Банк <your@yandex.ru>

# Supabase (обязательно для сохранения заявок)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...   # service_role key, не anon!

# Локальный сервер
PORT=3456
```

На **Vercel**: Settings → Environment Variables → добавить те же ключи.

---

## Настройка Supabase

1. Создайте проект на [supabase.com](https://supabase.com).
2. Выполните [`supabase-schema.sql`](supabase-schema.sql) в **SQL Editor**:

```sql
CREATE TABLE IF NOT EXISTS form_submissions (
  id              BIGSERIAL PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  name            TEXT NOT NULL,
  company         TEXT,
  phone           TEXT NOT NULL,
  email           TEXT NOT NULL,
  calculation_json JSONB
);
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
```

3. Получите ключи: **Settings → API**:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` (secret) → `SUPABASE_SERVICE_KEY`

Просматривать заявки: **Table Editor → form_submissions**.

---

## Настройка SMTP

| Провайдер | SMTP-хост | Порт | Лимит |
|---|---|---|---|
| **Yandex** (рекомендуется) | `smtp.yandex.ru` | 465 | ~300/день |
| Gmail | `smtp.gmail.com` | 465 | ~500/день |
| Mail.ru | `smtp.mail.ru` | 465 | ~100–300/день |

> Для больших объёмов: SendPulse, Brevo, Amazon SES.

**Yandex:**
1. Включите SMTP: [Настройки → Почтовые программы](https://mail.yandex.ru/?#setup/client).
2. Создайте пароль приложения: [id.yandex.ru → Безопасность → Пароли приложений](https://id.yandex.ru/security/app-passwords).
3. Используйте этот пароль в `SMTP_PASS` — не пароль от сайта.

**Gmail:**
1. Включите двухфакторную аутентификацию.
2. Создайте пароль приложения: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).

---

## Деплой на Vercel

1. Подключите репозиторий на [vercel.com](https://vercel.com) → **Import Project**.
2. **Root Directory** — корень репозитория (`kassy-deploy (root)`), не вложенная папка.
3. Добавьте переменные окружения (Settings → Environment Variables).
4. Deploy — статика и `api/` задеплоятся автоматически.

**Диагностика** (если заявки не пишутся в БД): Vercel → **Logs**, фильтр `[supabase]`:
- `[supabase] submission logged: email` — всё работает
- `[supabase] insert error: ...` — ошибка вставки
- `[supabase] not configured` — не заданы env vars

---

## API

| Метод | URL | Описание |
|---|---|---|
| `POST` | `/api/send-calculation` | Валидация → email → запись в Supabase |

Тело запроса:

```json
{
  "name": "Иванов Иван Иванович",
  "company": "ООО Пример",
  "phone": "+7 (900) 000-00-00",
  "email": "client@example.com",
  "calculation": {
    "registers": 50,
    "years": 3,
    "yearsLabel": "3 года",
    "purchaseTotalFormatted": "...",
    "purchaseLines": [...],
    "subscriptionMonthlyLines": [...],
    "..."  : "остальные поля из runCalculation()"
  }
}
```

---

## Формула расчёта

| Метрика | Формула |
|---|---|
| Покупка за период | (стоимость КСО + допы) × кол-во + сервис 4 000 ₽/мес × срок |
| Подписка за период | тариф/мес × кол-во × месяцы |
| Остаётся в обороте | сумма покупки − первый платёж по подписке |
| Экономия за период | покупка − подписка |

---

## Валидация формы

| Поле | Правила |
|---|---|
| ФИО | Только буквы (включая кириллицу), пробел, дефис, точка; 2–100 символов |
| Компания | Обязательное, до 150 символов |
| Телефон | Маска `+7 (XXX) XXX-XX-XX`; ровно 11 цифр |
| Email | Regex; TLD ≥ 2 символа |

---

## Типичные ошибки

| Симптом | Решение |
|---|---|
| «Не задана переменная SMTP_*» | Не создан или пустой `.env` / не добавлены env vars в Vercel |
| `Invalid login` / `535` | Нужен **пароль приложения**, не пароль от сайта |
| Письма не доходят | Проверьте «Спам»; не шлите много одинаковых подряд |
| Заявки не пишутся в Supabase | Проверьте Vercel Logs `[supabase]`; убедитесь что таблица создана и ключ `service_role` |
| `Function Runtimes must have a valid version` | В `vercel.json` удалите `"runtime": "nodejs20.x"` — версия берётся из `engines` в `package.json` |
