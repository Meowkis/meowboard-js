# Meowboard

A personal moodboard feed built with Express and SQLite. Visitors can browse cards and leave likes in the public section, while the private admin panel allows you to add and remove images, GIFs, quotes, audio, and video.

## Features

* responsive feed with multiple card types;
* anonymous likes without registration;
* admin panel with authentication, CSRF protection, and login rate limiting;
* media uploads up to 100 MB;
* SQLite storage without a separate database server;
* direct Node.js or Docker deployment.

## Stack

* Node.js 24 and Express 5;
* Nunjucks and HTMX;
* SQLite;
* vanilla JavaScript and CSS;
* Docker / Docker Compose.

## Quick Start

Node.js 24+ and npm are required.

```bash
git clone https://github.com/Meowkis/meowboard-js
cd meowboard-js
npm ci
cp .env.example .env
```

For local HTTP development, set `COOKIE_SECURE=false` in `.env`.

Generate an administrator password hash:

```bash
npm run admin:hash -- 'replace-with-a-strong-password'
```

Copy the entire generated value into `ADMIN_PASSWORD_HASH` in the `.env` file. Keep the single quotes around the value because the hash contains `$` characters.

Start the application:

```bash
npm start
```

After startup, the following URLs are available:

* public feed: http://localhost:3144;
* admin login: http://localhost:3144/admin/login.

The `data/my.db` database and media upload directories are created automatically.

## Environment Variables

| Variable              | Default              | Purpose                                                                                           |
| --------------------- | -------------------- | ------------------------------------------------------------------------------------------------- |
| `PORT`                | `3144`               | HTTP server port.                                                                                 |
| `OWNER_NICKNAME`      | `YourNickname`       | Owner nickname displayed in the page header.                                                      |
| `ADMIN_PASSWORD_HASH` | none                 | Required scrypt password hash for admin authentication.                                           |
| `COOKIE_SECURE`       | `true` in production | Adds the `Secure` flag to the admin session cookie. Use `false` for local HTTP.                   |
| `TRUST_PROXY`         | disabled             | Express `trust proxy` configuration. Use `1` when the application is behind a single Caddy proxy. |
| `NODE_ENV`            | none                 | When set to `production`, enables the secure default value for `COOKIE_SECURE`.                   |

## Docker

For local deployment without a reverse proxy:

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

For production deployment, use HTTPS and keep `COOKIE_SECURE=true`.

## Docker Compose and Caddy

The `compose.yml` file runs the application behind [Anubis](https://github.com/TecharoHQ/anubis). Caddy and Anubis share the external `caddy_net` network, while the application itself is only accessible to Anubis through the isolated `meowboard_internal` network. No ports are published directly to the host.

1. Create `.env` and specify the production password hash:

   ```dotenv
   OWNER_NICKNAME=YourNickname
   COOKIE_SECURE=true
   TRUST_PROXY=1
   ADMIN_PASSWORD_HASH='scrypt$...'
   ```

2. Create the shared Docker network once:

   ```bash
   docker network create caddy_net
   ```

3. Add the site to the Caddy container's `Caddyfile`:

   ```caddyfile
   meowboard.example.com {
     encode zstd gzip

     reverse_proxy http://meowboard-anubis:3000 {
       header_up X-Real-Ip {remote_host}
       header_up X-Http-Version {http.request.proto}
     }
   }
   ```

4. Build and start the services:

   ```bash
   docker compose build --no-cache
   docker compose up -d
   ```

   The first build takes longer than usual because the native SQLite module is compiled inside the Debian image. This avoids incompatibility between the host system's glibc and prebuilt `sqlite3` binaries.

Check service status and view logs:

```bash
docker compose ps
docker compose logs -f meowboard meowboard-anubis
```

## Managing Cards

Open `/admin/login`, sign in with the password used to generate the hash, and proceed to the card creation page.

| Type    | Supported files                               |
| ------- | --------------------------------------------- |
| `image` | JPG, PNG, WebP, AVIF                          |
| `gif`   | GIF                                           |
| `audio` | MP3, M4A, FLAC, WAV, OGG                      |
| `video` | MP4, MOV, WebM                                |
| `quote` | Text up to 5,000 characters; no file required |

A card title must contain between 1 and 160 characters. The maximum size of a single uploaded file is 100 MB.

When a card is deleted, its locally uploaded file is deleted as well. Likes are associated with an anonymous visitor cookie that remains valid for one year.

## Data and Backups

The service stores its state in two locations:

* `data/my.db` — cards, likes, and admin sessions;
* `public/media/` — uploaded media files.

For a complete backup, preserve both paths. Before copying the SQLite database file, it is better to stop writes to the service or stop the container itself:

```bash
docker compose stop meowboard
tar -czf meowboard-backup.tar.gz data public/media
docker compose start meowboard
```

## Project Structure

```text
index.js                   HTTP server, routes, SQLite, and file uploads
views/                     Nunjucks templates for the public section and admin panel
public/scripts/            client-side JavaScript
public/styles/             stylesheets
public/media/              uploaded images, GIFs, audio, and video
scripts/make-admin-hash.js administrator password hash generator
data/my.db                 SQLite database, created on first startup
compose.yml                production service configuration for the Caddy network
```

## License

[MIT](LICENSE)
