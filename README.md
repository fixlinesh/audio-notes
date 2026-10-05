# Audio Notes — multi-user version

Проект Figma Make с настоящей регистрацией пользователей и хранением аудиофайлов в Supabase.

## Что добавлено

- регистрация по email/password;
- вход и выход;
- сессия пользователя через Supabase Auth;
- каждый пользователь имеет отдельные данные;
- настоящая запись микрофона через MediaRecorder;
- запись сохраняется в Supabase Storage;
- загруженные аудио/видео сохраняются в Storage;
- таблица `lectures` связывает файл с `user_id`;
- Row Level Security не позволяет пользователю читать чужие записи;
- существующий `/api/summarize` с Anthropic сохранён.

## 1. Создать Supabase project

Откройте https://supabase.com/ и создайте проект.

В Supabase откройте **SQL Editor** и выполните весь файл `supabase.sql` из этого проекта.

Затем в **Project Settings → API** возьмите:

- Project URL
- anon/public key

## 2. Настроить `.env`

Скопируйте `.env.example` в `.env` и заполните:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_KEY
ANTHROPIC_MODEL=claude-sonnet-5-5
```

`VITE_*` значения являются публичными и предназначены для браузера. `ANTHROPIC_API_KEY` нельзя публиковать в клиентском коде; на Vercel он задаётся как server environment variable.

## 3. Установка и запуск

```bash
npm install
npm run dev
```

После этого откройте адрес Vite, например `http://localhost:5173`.

## 4. Email confirmation

В Supabase: **Authentication → Providers → Email**.

Для учебного/тестового запуска можно отключить подтверждение email. Для реального сайта лучше оставить подтверждение включённым и настроить SMTP/почту.

## 5. Публикация

Проект удобно разместить на Vercel. Добавьте туда все переменные окружения из `.env` (секрет Anthropic — только в server environment), а затем задеплойте проект.

После публикации любой человек получает одну ссылку, регистрируется своим email/password и получает собственный аккаунт.
