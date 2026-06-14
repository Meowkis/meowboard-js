# Meowboard

Персональная moodboard-лента на Express и SQLite. В публичной части посетители смотрят карточки и ставят лайки, а через закрытую админку можно добавлять и удалять изображения, GIF, цитаты, аудио и видео.

## Возможности

- адаптивная лента с карточками разных типов;
- анонимные лайки без регистрации;
- админка с авторизацией, CSRF-защитой и ограничением попыток входа;
- загрузка медиа до 100 МБ;
- хранение данных в SQLite без отдельного сервера БД;
- запуск напрямую через Node.js или в Docker.

## Стек

- Node.js 24 и Express 5;
- Nunjucks и HTMX;
- SQLite;
- vanilla JavaScript и CSS;
- Docker / Docker Compose.

## Быстрый запуск

Понадобятся Node.js 24+ и npm.

```bash
git clone https://github.com/Meowkis/meowboard-js
cd meowboard-js
npm ci
cp .env.example .env
```

Для локального запуска по HTTP установите в `.env` значение `COOKIE_SECURE=false`.

Сгенерируйте хеш пароля администратора:

```bash
npm run admin:hash -- 'replace-with-a-strong-password'
```

Вставьте полученную строку целиком в `ADMIN_PASSWORD_HASH` файла `.env`. Одинарные кавычки вокруг значения нужно сохранить: хеш содержит символы `$`.

Запустите приложение:

```bash
npm start
```

После запуска доступны:

- публичная лента: <http://localhost:3144>;
- вход в админку: <http://localhost:3144/admin/login>.

База `data/my.db` и каталоги для загруженных файлов создаются автоматически.

## Переменные окружения

| Переменная | По умолчанию | Назначение |
| --- | --- | --- |
| `PORT` | `3144` | Порт HTTP-сервера. |
| `ADMIN_PASSWORD_HASH` | нет | Обязательный scrypt-хеш пароля для входа в админку. |
| `COOKIE_SECURE` | `true` в production | Добавляет флаг `Secure` к cookie админ-сессии. Для локального HTTP используйте `false`. |
| `TRUST_PROXY` | выключено | Настройка Express `trust proxy`. Для одного Caddy перед приложением используйте `1`. |
| `NODE_ENV` | нет | При значении `production` включает безопасное значение `COOKIE_SECURE` по умолчанию. |

## Docker

Для локального запуска без reverse proxy:

```bash
npm run admin:hash -- 'replace-with-a-strong-password'
export ADMIN_PASSWORD_HASH='paste-generated-scrypt-hash-here'

docker build -t meowboard .
docker run --name meowboard --rm \
  -p 3144:3144 \
  -e ADMIN_PASSWORD_HASH="$ADMIN_PASSWORD_HASH" \
  -e COOKIE_SECURE=false \
  -v "$PWD/data:/app/data" \
  -v "$PWD/public/media:/app/public/media" \
  meowboard
```

Для production-развёртывания используйте HTTPS и оставьте `COOKIE_SECURE=true`.

## Docker Compose и Caddy

Файл `compose.yml` запускает приложение за [Anubis](https://github.com/TecharoHQ/anubis). Caddy и Anubis находятся в общей внешней сети `caddy_net`, а само приложение доступно Anubis только через изолированную сеть `meowboard_internal`. Порты на хост не публикуются.

1. Создайте `.env` и укажите production-хеш:

   ```dotenv
   COOKIE_SECURE=true
   TRUST_PROXY=1
   ADMIN_PASSWORD_HASH='scrypt$...'
   ```

2. Один раз создайте общую Docker-сеть:

   ```bash
   docker network create caddy_net
   ```

3. Добавьте сайт в `Caddyfile` контейнера Caddy:

   ```caddyfile
   meowboard.example.com {
     encode zstd gzip

     reverse_proxy http://meowboard-anubis:3000 {
       header_up X-Real-Ip {remote_host}
       header_up X-Http-Version {http.request.proto}
     }
   }
   ```

4. Соберите и запустите сервис:

   ```bash
   docker compose build --no-cache
   docker compose up -d
   ```

   Первая сборка занимает дольше обычного: нативный модуль SQLite компилируется внутри Debian-образа. Это исключает несовместимость системной glibc с готовыми бинарниками `sqlite3`.

Проверка состояния и просмотр логов:

```bash
docker compose ps
docker compose logs -f meowboard meowboard-anubis
```

## Работа с карточками

Откройте `/admin/login`, войдите с паролем, для которого был создан хеш, и перейдите к добавлению карточки.

| Тип | Поддерживаемые файлы |
| --- | --- |
| `image` | JPG, PNG, WebP, AVIF |
| `gif` | GIF |
| `audio` | MP3, M4A, FLAC, WAV, OGG |
| `video` | MP4, MOV, WebM |
| `quote` | Текст до 5000 символов, файл не нужен |

Название карточки должно содержать от 1 до 160 символов. Максимальный размер одного файла — 100 МБ.

При удалении карточки загруженный для неё локальный файл также удаляется. Лайки привязаны к анонимной cookie посетителя сроком на один год.

## Данные и резервные копии

Состояние сервиса хранится в двух местах:

- `data/my.db` — карточки, лайки и админ-сессии;
- `public/media/` — загруженные медиафайлы.

Для полного бэкапа сохраняйте оба пути. Перед копированием SQLite-файла лучше остановить запись в сервис или сам контейнер:

```bash
docker compose stop meowboard
tar -czf meowboard-backup.tar.gz data public/media
docker compose start meowboard
```

## Структура проекта

```text
index.js                 HTTP-сервер, маршруты, SQLite и загрузка файлов
views/                   Nunjucks-шаблоны публичной части и админки
public/scripts/          клиентский JavaScript
public/styles/           стили
public/media/            загруженные изображения, GIF, аудио и видео
scripts/make-admin-hash.js  генератор хеша пароля администратора
data/my.db               SQLite-база, создаётся при первом запуске
compose.yml              production-сервис для сети Caddy
```

## Лицензия

[MIT](LICENSE)
