const express = require("express");
const nunjucks = require("nunjucks");
const sqlite3 = require("sqlite3").verbose();
const cookieParser = require("cookie-parser");
const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const multer = require("multer");
const rateLimit = require("express-rate-limit");

const app = express();
const port = process.env.PORT || 3144;
const ownerNickname = String(process.env.OWNER_NICKNAME || "").trim()
  || "YourNickname";

if (process.env.TRUST_PROXY) {
  const trustProxyHops = Number(process.env.TRUST_PROXY);

  app.set(
    "trust proxy",
    Number.isInteger(trustProxyHops) ? trustProxyHops : process.env.TRUST_PROXY
  );
}

const path = require("node:path");

const dbPath = path.join(__dirname, "data", "my.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new sqlite3.Database(dbPath);

const ADMIN_COOKIE_NAME = "meow_admin_session";
const ADMIN_SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 8;

const tmpUploadDir = path.join(__dirname, "public", "media", ".tmp");
const publicMediaDir = path.join(__dirname, "public", "media");

const mediaDirs = {
  image: path.join(publicMediaDir, "images"),
  gif: path.join(publicMediaDir, "gifs"),
  audio: path.join(publicMediaDir, "audios"),
  video: path.join(publicMediaDir, "videos")
};

const mediaUrlPrefix = {
  image: "/media/images",
  gif: "/media/gifs",
  audio: "/media/audios",
  video: "/media/videos"
};

const allowedMedia = {
  image: {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/avif": ".avif"
  },
  gif: {
    "image/gif": ".gif"
  },
  audio: {
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/x-m4a": ".m4a",
    "audio/flac": ".flac",
    "audio/wav": ".wav",
    "audio/ogg": ".ogg"
  },
  video: {
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm"
  }
};

fs.mkdirSync(tmpUploadDir, { recursive: true });

for (const dir of Object.values(mediaDirs)) {
  fs.mkdirSync(dir, { recursive: true });
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function safeEqualString(a, b) {
  const aBuf = Buffer.from(String(a || ""));
  const bBuf = Buffer.from(String(b || ""));

  return aBuf.length === bBuf.length && crypto.timingSafeEqual(aBuf, bBuf);
}

function safeUnlink(filePath) {
  if (!filePath) return;

  fsp.unlink(filePath).catch(() => {});
}

function mediaUrlToLocalPath(mediaUrl) {
  if (!mediaUrl || typeof mediaUrl !== "string") {
    return null;
  }

  if (!mediaUrl.startsWith("/media/")) {
    return null;
  }

  const relativePath = mediaUrl.replace(/^\/media\//, "");
  const resolvedPath = path.resolve(publicMediaDir, relativePath);
  const resolvedMediaDir = path.resolve(publicMediaDir);

  if (
    resolvedPath !== resolvedMediaDir &&
    !resolvedPath.startsWith(resolvedMediaDir + path.sep)
  ) {
    return null;
  }

  return resolvedPath;
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));


const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false
});

nunjucks.configure(path.join(__dirname, "views"), {
  autoescape: true,
  express: app,
  watch: true,
  noCache: true
});

app.set("view engine", "njk");

app.use((req, res, next) => {
  if (!req.cookies.meow_anon_id) {
    res.cookie("meow_anon_id", crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 365
    });
  }

  next();
});


db.serialize(() => {
  db.run("PRAGMA foreign_keys = ON");

  db.run(`
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      type TEXT NOT NULL CHECK (
        type IN ('image', 'gif', 'quote', 'audio', 'video')
      ),

      title TEXT NOT NULL,

      media_url TEXT,
      mime_type TEXT,

      quote_text TEXT,
      quote_author TEXT,

      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS card_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      card_id INTEGER NOT NULL,
      anon_id TEXT NOT NULL,

      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      UNIQUE(card_id, anon_id),

      FOREIGN KEY (card_id)
        REFERENCES cards(id)
        ON DELETE CASCADE
    )
  `);
  db.run(`
  CREATE TABLE IF NOT EXISTS admin_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    token_hash TEXT NOT NULL UNIQUE,
    csrf_token TEXT NOT NULL,

    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at
    ON admin_sessions(expires_at)
  `);
});

/*
db.serialize(() => {
  db.run("PRAGMA foreign_keys = ON");

  db.run(`
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      type TEXT NOT NULL CHECK (
        type IN ('image', 'gif', 'quote', 'audio', 'video')
      ),

      title TEXT NOT NULL,

      media_url TEXT,
      mime_type TEXT,

      quote_text TEXT,
      quote_author TEXT,

      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS card_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      card_id INTEGER NOT NULL,
      anon_id TEXT NOT NULL,

      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      UNIQUE(card_id, anon_id),

      FOREIGN KEY (card_id)
        REFERENCES cards(id)
        ON DELETE CASCADE
    )
  `);

  db.get("SELECT COUNT(*) AS count FROM cards", (err, row) => {
    if (err) {
      console.error(err);
      return;
    }

    if (row.count > 0) {
      return;
    }

    const insertCard = db.prepare(`
      INSERT INTO cards (
        type,
        title,
        media_url,
        mime_type,
        quote_text,
        quote_author
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertCard.run(
      "gif",
      "Ye, we're just a test.",
      "https://i.pinimg.com/originals/1b/32/f7/1b32f7188d15f2576c56d0559d2de6cc.gif",
      "image/gif",
      null,
      null
    );

    insertCard.run(
      "image",
      "Test.",
      "https://i.pinimg.com/originals/1b/32/f7/1b32f7188d15f2576c56d0559d2de6cc.gif",
      "image/gif",
      null,
      null
    );

    insertCard.run(
      "quote",
      "Neon Genesis Evangelion",
      null,
      null,
      "“The chance of success is only 0.00001%.”\n“It's not zero;”",
      "Ritsuko Akagi"
    );

    insertCard.run(
      "audio",
      "Memento mori",
      "/media/audios/memento-mori.flac",
      "audio/flac",
      null,
      null
    );

    insertCard.run(
      "audio",
      "Deane - Human Feel",
      "/media/audios/Deane-Human-Feel.m4a",
      "audio/mp4",
      null,
      null
    );

    insertCard.run(
      "audio",
      "What Does Anybody Know About Anything",
      "/media/audios/Chris-Zabriskie-What-Does-Anybody-Know-About-Anything.m4a",
      "audio/mp4",
      null,
      null
    );

    insertCard.run(
      "audio",
      "Furious Angels",
      "/media/audios/Furious-Angels-Rob-Dougan-Matrix-Reloaded.m4a",
      "audio/mp4",
      null,
      null
    );

    insertCard.run(
      "audio",
      "Luminescent",
      "/media/audios/Mittsies-Luminescent.m4a",
      "audio/mp4",
      null,
      null
    );

    insertCard.run(
      "video",
      "hmiku-edit",
      "/media/videos/hmiku-edit.mp4",
      "video/mp4",
      null,
      null
    );

    insertCard.run(
      "video",
      "logger_log",
      "/media/videos/logger_log.mp4",
      "video/quicktime",
      null,
      null
    );

    insertCard.run(
      "video",
      "old_intro_1",
      "/media/videos/old_intro_1.mp4",
      "video/mp4",
      null,
      null
    );

    insertCard.run(
      "video",
      "oldest_intro",
      "/media/videos/oldest_intro.mp4",
      "video/mp4",
      null,
      null
    );

    insertCard.run(
      "video",
      "tea",
      "/media/videos/tea.mp4",
      "video/mp4",
      null,
      null
    );

    insertCard.finalize();

    const insertLike = db.prepare(`
      INSERT OR IGNORE INTO card_likes (
        card_id,
        anon_id
      ) VALUES (?, ?)
    `);

    insertLike.run(1, "test-user-1");
    insertLike.run(1, "test-user-2");
    insertLike.run(3, "test-user-1");

    insertLike.finalize();
  });
});
*/

function getCards(anonId, callback) {
  db.all(`
  SELECT
    cards.id,
    cards.type,
    cards.title,
    cards.media_url,
    cards.mime_type,
    cards.quote_text,
    cards.quote_author,
    cards.created_at,
    COUNT(card_likes.id) AS like_count,
    CASE
      WHEN viewer_likes.id IS NULL THEN 0
      ELSE 1
    END AS liked_by_viewer
  FROM cards
  LEFT JOIN card_likes
    ON card_likes.card_id = cards.id
  LEFT JOIN card_likes AS viewer_likes
    ON viewer_likes.card_id = cards.id
    AND viewer_likes.anon_id = ?
  GROUP BY cards.id
  ORDER BY cards.created_at DESC, cards.id DESC
`, [anonId], callback);
}

function getLikeState(cardId, anonId, callback) {
  db.get(
    `
      SELECT
        cards.id AS card_id,
        COUNT(card_likes.id) AS like_count,
        CASE
          WHEN viewer_likes.id IS NULL THEN 0
          ELSE 1
        END AS liked_by_viewer
      FROM cards
      LEFT JOIN card_likes
        ON card_likes.card_id = cards.id
      LEFT JOIN card_likes AS viewer_likes
        ON viewer_likes.card_id = cards.id
        AND viewer_likes.anon_id = ?
      WHERE cards.id = ?
      GROUP BY cards.id
    `,
    [anonId, cardId],
    callback
  );
}

function verifyAdminPassword(password, encodedHash, callback) {
  try {
    const parts = String(encodedHash || "").split("$");

    if (parts.length !== 6 || parts[0] !== "scrypt") {
      callback(new Error("Invalid ADMIN_PASSWORD_HASH format"));
      return;
    }

    const cost = Number(parts[1]);
    const blockSize = Number(parts[2]);
    const parallelization = Number(parts[3]);
    const salt = Buffer.from(parts[4], "base64url");
    const expectedHash = Buffer.from(parts[5], "base64url");

    crypto.scrypt(
      password,
      salt,
      expectedHash.length,
      {
        cost,
        blockSize,
        parallelization,
        maxmem: 128 * 1024 * 1024
      },
      (err, actualHash) => {
        if (err) {
          callback(err);
          return;
        }

        const ok =
          actualHash.length === expectedHash.length &&
          crypto.timingSafeEqual(actualHash, expectedHash);

        callback(null, ok);
      }
    );
  } catch (err) {
    callback(err);
  }
}

function isSecureCookieEnabled() {
  if (process.env.COOKIE_SECURE !== undefined) {
    return process.env.COOKIE_SECURE === "true";
  }

  return process.env.NODE_ENV === "production";
}

function setAdminCookie(res, token) {
  res.cookie(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: isSecureCookieEnabled(),
    maxAge: ADMIN_SESSION_MAX_AGE_MS,
    path: "/"
  });
}

function clearAdminCookie(res) {
  res.clearCookie(ADMIN_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "strict",
    secure: isSecureCookieEnabled(),
    path: "/"
  });
}

function requireAdmin(req, res, next) {
  const token = req.cookies[ADMIN_COOKIE_NAME];

  if (!token) {
    console.log("NO ADMIN TOKEN COOKIE");
    res.redirect("/admin/login");
    return;
  }

  const tokenHash = sha256Hex(token);

  db.get(
    `
      SELECT
        token_hash,
        csrf_token,
        expires_at
      FROM admin_sessions
      WHERE token_hash = ?
    `,
    [tokenHash],
    (err, session) => {
      if (err) {
        console.error(err);
        res.status(500).send("Database error");
        return;
      }

      if (!session || session.expires_at <= Date.now()) {
        clearAdminCookie(res);

        db.run(
          `
            DELETE FROM admin_sessions
            WHERE token_hash = ?
          `,
          [tokenHash]
        );

        res.redirect("/admin/login");
        return;
      }

      req.adminSession = session;
      next();
    }
  );
}

function verifyCsrf(req, res, next) {
  const tokenFromBody = req.body?._csrf;
  const tokenFromSession = req.adminSession?.csrf_token;

  if (!safeEqualString(tokenFromBody, tokenFromSession)) {
    if (req.file?.path) {
      safeUnlink(req.file.path);
    }

    res.status(403).send("Invalid CSRF token");
    return;
  }

  next();
}

const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, callback) {
      callback(null, tmpUploadDir);
    },

    filename(req, file, callback) {
      const name = `${Date.now()}-${crypto.randomBytes(16).toString("hex")}.tmp`;
      callback(null, name);
    }
  }),

  limits: {
    files: 1,
    fileSize: 100 * 1024 * 1024
  },

  fileFilter(req, file, callback) {
    const allowed = Object.values(allowedMedia).some((mimeMap) =>
      hasOwn(mimeMap, file.mimetype)
    );

    if (!allowed) {
      callback(new Error("Unsupported file type"));
      return;
    }

    callback(null, true);
  }
});



app.get("/", (req, res) => {
  const anonId = req.cookies.meow_anon_id;

  getCards(anonId, (err, cards) => {
    if (err) {
      console.error(err);
      res.status(500).send("Database error");
      return;
    }

    res.render("index.njk", {
      cards,
      ownerNickname
    });
  });
});


function requireLikeableCard(req, res, next) {
  const cardId = Number(req.params.id);

  if (!Number.isInteger(cardId) || cardId <= 0) {
    next();
    return;
  }

  db.get(
    "SELECT type FROM cards WHERE id = ?",
    [cardId],
    (err, card) => {
      if (err) {
        console.error(err);
        res.status(500).send("Database error");
        return;
      }

      if (!card) {
        res.status(404).send("Card not found");
        return;
      }

      if (card.type === "audio") {
        res.status(403).send("Audio cards cannot be liked");
        return;
      }

      next();
    }
  );
}

app.post("/cards/:id/like", requireLikeableCard, (req, res) => {
  const cardId = Number(req.params.id);
  const anonId = req.cookies.meow_anon_id;

  if (!Number.isInteger(cardId) || cardId <= 0) {
    res.status(400).send("Invalid card id");
    return;
  }

  db.get(
    `
      SELECT id
      FROM card_likes
      WHERE card_id = ?
        AND anon_id = ?
    `,
    [cardId, anonId],
    (err, existingLike) => {
      if (err) {
        console.error(err);
        res.status(500).send("Database error");
        return;
      }

      if (existingLike) {
        db.run(
          `
            DELETE FROM card_likes
            WHERE card_id = ?
              AND anon_id = ?
          `,
          [cardId, anonId],
          (err) => {
            if (err) {
              console.error(err);
              res.status(500).send("Database error");
              return;
            }

            getLikeState(cardId, anonId, (err, state) => {
              if (err) {
                console.error(err);
                res.status(500).send("Database error");
                return;
              }

              res.render("partials/like-button.njk", {
                card: {
                  id: cardId,
                  like_count: state.like_count,
                  liked_by_viewer: state.liked_by_viewer
                }
              });
            });
          }
        );

        return;
      }

      db.run(
        `
          INSERT INTO card_likes (
            card_id,
            anon_id
          ) VALUES (?, ?)
        `,
        [cardId, anonId],
        (err) => {
          if (err) {
            console.error(err);
            res.status(500).send("Database error");
            return;
          }

          getLikeState(cardId, anonId, (err, state) => {
            if (err) {
              console.error(err);
              res.status(500).send("Database error");
              return;
            }

            res.render("partials/like-button.njk", {
              card: {
                id: cardId,
                like_count: state.like_count,
                liked_by_viewer: state.liked_by_viewer
              }
            });
          });
        }
      );
    }
  );
});


const loginAttempts = new Map();

function getLoginKey(req) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function isLoginLocked(key) {
  const item = loginAttempts.get(key);

  if (!item) return false;

  if (item.lockedUntil && item.lockedUntil > Date.now()) {
    return true;
  }

  if (item.lockedUntil && item.lockedUntil <= Date.now()) {
    loginAttempts.delete(key);
  }

  return false;
}

function recordLoginFailure(key) {
  const item = loginAttempts.get(key) || {
    count: 0,
    lockedUntil: 0
  };

  item.count += 1;

  if (item.count >= 5) {
    item.lockedUntil = Date.now() + 1000 * 60 * 15;
  }

  loginAttempts.set(key, item);
}

function clearLoginFailures(key) {
  loginAttempts.delete(key);
}

app.get("/admin", requireAdmin, (req, res) => {
  res.redirect("/admin/cards");
});

app.get("/admin/login", (req, res) => {
  res.render("admin-login.njk", {
    error: null
  });
});

app.post("/admin/login",adminLoginLimiter, (req, res) => {
  const key = getLoginKey(req);

  if (isLoginLocked(key)) {
    res.status(429).render("admin-login.njk", {
      error: "Слишком много попыток. Попробуй позже."
    });
    return;
  }

  const password = String(req.body.password || "");

  if (!process.env.ADMIN_PASSWORD_HASH) {
    console.error("ADMIN_PASSWORD_HASH is not set");

    res.status(500).render("admin-login.njk", {
      error: "Admin password hash is not configured."
    });
    return;
  }

  verifyAdminPassword(password, process.env.ADMIN_PASSWORD_HASH, (err, ok) => {
    if (err) {
      console.error(err);

      res.status(500).render("admin-login.njk", {
        error: "Auth error."
      });
      return;
    }

    if (!ok) {
      recordLoginFailure(key);

      res.status(401).render("admin-login.njk", {
        error: "Неверный пароль."
      });
      return;
    }

    clearLoginFailures(key);

    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = sha256Hex(token);
    const csrfToken = crypto.randomBytes(32).toString("base64url");
    const now = Date.now();
    const expiresAt = now + ADMIN_SESSION_MAX_AGE_MS;

    db.run(
      `
        DELETE FROM admin_sessions
        WHERE expires_at <= ?
      `,
      [now]
    );

    db.run(
      `
        INSERT INTO admin_sessions (
          token_hash,
          csrf_token,
          created_at,
          expires_at
        ) VALUES (?, ?, ?, ?)
      `,
      [tokenHash, csrfToken, now, expiresAt],
      (err) => {
        if (err) {
          console.error(err);
          res.status(500).send("Database error");
          return;
        }

        setAdminCookie(res, token);
        res.redirect("/admin/cards/new");
      }
    );
  });
});

app.post("/admin/logout", requireAdmin, verifyCsrf, (req, res) => {
  db.run(
    `
      DELETE FROM admin_sessions
      WHERE token_hash = ?
    `,
    [req.adminSession.token_hash],
    (err) => {
      if (err) {
        console.error(err);
      }

      clearAdminCookie(res);
      res.redirect("/admin/login");
    }
  );
});

app.get("/admin/cards", requireAdmin, async (req, res) => {
  try {
    const cards = await dbAll(
      `
        SELECT
          id,
          type,
          title,
          media_url,
          mime_type,
          quote_text,
          quote_author,
          created_at
        FROM cards
        ORDER BY created_at DESC, id DESC
      `
    );

    res.render("admin-cards.njk", {
      csrfToken: req.adminSession.csrf_token,
      cards
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

app.post("/admin/cards/:id/delete", requireAdmin, verifyCsrf, async (req, res) => {
  try {
    const cardId = Number(req.params.id);

    if (!Number.isInteger(cardId) || cardId <= 0) {
      res.status(400).send("Invalid card id");
      return;
    }

    const card = await dbGet(
      `
        SELECT
          id,
          media_url
        FROM cards
        WHERE id = ?
      `,
      [cardId]
    );

    if (!card) {
      res.redirect("/admin/cards");
      return;
    }

    await dbRun(
      `
        DELETE FROM cards
        WHERE id = ?
      `,
      [cardId]
    );

    const localPath = mediaUrlToLocalPath(card.media_url);

    if (localPath) {
      safeUnlink(localPath);
    }

    res.redirect("/admin/cards");
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

app.get("/admin/cards/new", requireAdmin, (req, res) => {
  res.render("admin-card-new.njk", {
    csrfToken: req.adminSession.csrf_token,
    error: null,
    form: {}
  });
});

app.post("/admin/cards", requireAdmin, (req, res) => {
  upload.single("media_file")(req, res, async (uploadErr) => {
    let finalPath = null;

    try {
      if (uploadErr) {
        res.status(400).render("admin-card-new.njk", {
          csrfToken: req.adminSession.csrf_token,
          error: uploadErr.message,
          form: req.body || {}
        });
        return;
      }

      if (!safeEqualString(req.body?._csrf, req.adminSession.csrf_token)) {
        if (req.file?.path) {
          safeUnlink(req.file.path);
        }

        res.status(403).send("Invalid CSRF token");
        return;
      }

      const type = String(req.body.type || "").trim();
      const title = String(req.body.title || "").trim();
      const quoteText = String(req.body.quote_text || "").trim();
      const quoteAuthor = String(req.body.quote_author || "").trim();

      if (!["image", "gif", "quote", "audio", "video"].includes(type)) {
        if (req.file?.path) safeUnlink(req.file.path);

        res.status(400).render("admin-card-new.njk", {
          csrfToken: req.adminSession.csrf_token,
          error: "Неверный тип карточки.",
          form: req.body
        });
        return;
      }

      if (title.length < 1 || title.length > 160) {
        if (req.file?.path) safeUnlink(req.file.path);

        res.status(400).render("admin-card-new.njk", {
          csrfToken: req.adminSession.csrf_token,
          error: "Название должно быть от 1 до 160 символов.",
          form: req.body
        });
        return;
      }

      let mediaUrl = null;
      let mimeType = null;
      let dbQuoteText = null;
      let dbQuoteAuthor = null;

      if (type === "quote") {
        if (req.file?.path) {
          safeUnlink(req.file.path);

          res.status(400).render("admin-card-new.njk", {
            csrfToken: req.adminSession.csrf_token,
            error: "Для quote-карточки файл не нужен.",
            form: req.body
          });
          return;
        }

        if (quoteText.length < 1 || quoteText.length > 5000) {
          res.status(400).render("admin-card-new.njk", {
            csrfToken: req.adminSession.csrf_token,
            error: "Текст цитаты должен быть от 1 до 5000 символов.",
            form: req.body
          });
          return;
        }

        dbQuoteText = quoteText;
        dbQuoteAuthor = quoteAuthor || null;
      } else {
        if (!req.file) {
          res.status(400).render("admin-card-new.njk", {
            csrfToken: req.adminSession.csrf_token,
            error: "Для этого типа карточки нужен файл.",
            form: req.body
          });
          return;
        }

        const mimeMap = allowedMedia[type];

        if (!mimeMap || !hasOwn(mimeMap, req.file.mimetype)) {
          safeUnlink(req.file.path);

          res.status(400).render("admin-card-new.njk", {
            csrfToken: req.adminSession.csrf_token,
            error: "Файл не подходит для выбранного типа карточки.",
            form: req.body
          });
          return;
        }

        const ext = mimeMap[req.file.mimetype];
        const filename = `${Date.now()}-${crypto.randomBytes(16).toString("hex")}${ext}`;

        finalPath = path.join(mediaDirs[type], filename);

        await fsp.rename(req.file.path, finalPath);

        mediaUrl = `${mediaUrlPrefix[type]}/${filename}`;
        mimeType = req.file.mimetype;
      }

      await dbRun(
        `
          INSERT INTO cards (
            type,
            title,
            media_url,
            mime_type,
            quote_text,
            quote_author
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          type,
          title,
          mediaUrl,
          mimeType,
          dbQuoteText,
          dbQuoteAuthor
        ]
      );

      res.redirect("/admin/cards");
    } catch (err) {
      console.error(err);

      if (req.file?.path) {
        safeUnlink(req.file.path);
      }

      if (finalPath) {
        safeUnlink(finalPath);
      }

      res.status(500).render("admin-card-new.njk", {
        csrfToken: req.adminSession.csrf_token,
        error: "Ошибка сохранения карточки.",
        form: req.body || {}
      });
    }
  });
});

app.listen(port, () => {
  console.log(`Server listening on http://127.0.0.1:${port}`);
});
