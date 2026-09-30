# kassy — гайд по деплою

Калькулятор касс самообслуживания (Альфа-Банк): лендинг, 5 шагов расчёта, письмо на почту, заявки в базу.

Репозиторий: [github.com/Axer-me/kassy-deploy](https://github.com/Axer-me/kassy-deploy)

**Стек продакшена**

| Часть | Где |
|-------|-----|
| Сайт и API | [Vercel](https://vercel.com) → ссылка `https://….vercel.app` |
| Заявки (статистика) | [Supabase](https://supabase.com), таблица `form_submissions` |
| Письма | SMTP (Yandex или Gmail, пароль приложения) |

Turso в этой версии **не используется**. `.env` в git **не класть**.

```
Посетитель
  →  Vercel (index.html + картинки)
  →  POST /api/send-calculation
        → SMTP → письмо клиенту
        → Supabase → строка в form_submissions
```

---

## Что подготовить заранее

1. Аккаунт [GitHub](https://github.com) — код уже лежит в `Axer-me/kassy-deploy`.
2. Аккаунт [Vercel](https://vercel.com) (Hobby), вход через GitHub.
3. Аккаунт [Supabase](https://supabase.com) (бесплатный проект).
4. Почта с SMTP: пароль **приложения**, не обычный пароль от ящика.

Панели Vercel/Supabase с компьютера в РФ иногда не открываются. Сайт для заказчика — это `*.vercel.app`; его visiter открывает без кабинета.

---

## Шаг 1. Supabase (база заявок)

### 1.1. Проект

1. [supabase.com](https://supabase.com) → Sign up.
2. **New project**: имя `kassy`, пароль базы сохраните, регион — Европа (Frankfurt), если есть.
3. Дождитесь статуса Ready.

### 1.2. Таблица

**SQL Editor** → New query → вставить и **Run**:

```sql
CREATE TABLE IF NOT EXISTS form_submissions (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  name        TEXT NOT NULL,
  company     TEXT,
  phone       TEXT NOT NULL,
  email       TEXT NOT NULL,
  calculation_json JSONB
);

ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
```

Должно быть Success. Тот же SQL лежит в репозитории: [`supabase-schema.sql`](supabase-schema.sql).

RLS включён специально: с браузера таблицу не читают, пишет только сервер с секретным ключом.

### 1.3. Ключи

**Project Settings → API** (или **Data API**):

| В кабинете | Переменная |
|------------|------------|
| Project URL `https://xxxx.supabase.co` | `SUPABASE_URL` |
| `service_role` (**secret**), не `anon` | `SUPABASE_SERVICE_KEY` |

`service_role` — полный доступ к базе. Только в Vercel / локальный `.env`.

Заявки смотреть: **Table Editor → form_submissions**.

---

## Шаг 2. SMTP (письма)

Нужен пароль приложения.

**Yandex** (часто проще из РФ):

1. Включить IMAP/SMTP: [Почтовые программы](https://mail.yandex.ru/?#setup/client).
2. [Пароль приложения](https://id.yandex.ru/security/app-passwords).
3. Хост `smtp.yandex.ru`, порт `465`, `SMTP_SECURE=true`.

**Gmail:**

1. Включить 2FA.
2. [Пароль приложения](https://myaccount.google.com/apppasswords).
3. Хост `smtp.gmail.com`, порт `465`, `SMTP_SECURE=true`.

`SMTP_FROM` можно так: `Альфа-Банк <ваш@ящик>`.

---

## Шаг 3. Vercel (публичная ссылка)

Код уже на GitHub. Если правили локально — `git push` в `kassy-deploy`.

### 3.1. Import

1. [vercel.com/new](https://vercel.com/new) → Import **`Axer-me/kassy-deploy`**.
2. Экран New Project:

| Поле | Значение |
|------|----------|
| Vercel Team | свой Hobby, не трогать |
| Project Name | `kassy-deploy` или любое |
| **Root Directory** | **`kassy-deploy (root)`** — первая строка. Не `api`, не `kassa-email-server` |
| Application Preset | **Other** или оставить авто. Не обязательно Express |

3. Раскрыть **Environment Variables** и добавить **до** Create Project (иначе потом Redeploy):

| Имя | Пример |
|-----|--------|
| `SMTP_HOST` | `smtp.gmail.com` или `smtp.yandex.ru` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | ваш ящик |
| `SMTP_PASS` | пароль приложения |
| `SMTP_FROM` | `Альфа-Банк <ваш@ящик>` |
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | ключ `service_role` |

Environment: Production (и Preview, если превью тоже должно писать в ту же базу).

4. **Build and Output Settings** не менять.
5. **Create Project**.

Через 1–2 минуты будет `https://kassy-deploy-xxxx.vercel.app`.

Если переменные добавили **после** первого деплоя: Settings → Environment Variables → Deployments → ⋯ → **Redeploy**.

Если Root Directory ошибочно `kassa-email-server`: Settings → General → Root Directory → корень → Redeploy.

---

## Шаг 4. Проверка

1. Открыть `https://….vercel.app` (из РФ `*.vercel.app` чаще открывается без VPN).
2. Калькулятор до формы → свой email → «Получить расчёт».
3. Почта и папка «Спам».
4. Supabase → Table Editor → `form_submissions` — новая строка.
5. Подождать 15 минут, обновить таблицу — строка **остаётся** (это облако, не диск Vercel).

Логи: Vercel → Deployment → Logs.

| В логе | Смысл |
|--------|--------|
| `[supabase] submission logged:` | заявка записана |
| `[supabase] not configured` | нет URL или service_role на Vercel |
| `[supabase] insert error:` | таблица не создана / неверный ключ / RLS без service_role |
| ошибка SMTP / `535` | пароль приложения или хост |

---

## Локальный запуск (не обязательно для прода)

```powershell
cd путь\к\kassy-deploy
npm install
copy .env.example .env
```

Заполнить SMTP и Supabase в `.env`. Затем:

```powershell
npm start
```

http://localhost:3456/

С телефона в той же Wi‑Fi:

```powershell
$env:HOST="0.0.0.0"; npm start
```

IP в `ipconfig` → `http://192.168.x.x:3456/`.

---

## Что не делать

- Не коммитить `.env`.
- Не вешать свой `.ru` напрямую на DNS Vercel — из РФ кастомный домен часто рвётся; для демо достаточно `*.vercel.app`.
- Не использовать ключ `anon` вместо `service_role`.
- Не выбирать Root Directory папку `api`.

---

## Обновления сайта

Правите код → `git push` в `kassy-deploy` → Vercel пересобирает сам. Заказчику давайте **Production** URL, не Preview (`*-git-*.vercel.app`).

---

## Частые ошибки

| Симптом | Что сделать |
|---------|-------------|
| 404 / пустой сайт | Root Directory = корень репозитория |
| Форма: нет SMTP_* | переменные в Vercel + Redeploy |
| `535` / Invalid login | пароль приложения, хост совпадает с почтой |
| Письма нет, заявка в таблице есть | «Спам»; SMTP с IP Vercel |
| Письмо есть, таблицы пустые | `SUPABASE_*`, SQL таблицы, ключ service_role, Redeploy |
| `*.vercel.app` не открывается у части провайдеров РФ | другой интернет; свой домен на Vercel не панацея |
