'use strict';
const Database = require('better-sqlite3');
const bcrypt   = require('bcryptjs');
const path     = require('path');
const fs       = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'wappstore.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let _db = null;
let _ftsReady = false;
function ftsReady() { return _ftsReady; }

function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH);
    // WAL is best on Linux; fall back silently if the filesystem doesn't support it
    try { _db.pragma('journal_mode = WAL'); } catch {}
    _db.pragma('foreign_keys = ON');
  }
  return _db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      email         TEXT    UNIQUE NOT NULL,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'client',
      avatar_url    TEXT,
      active        INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name_es    TEXT NOT NULL,
      name_en    TEXT NOT NULL,
      slug       TEXT UNIQUE NOT NULL,
      icon       TEXT DEFAULT '📦',
      color      TEXT DEFAULT '#6C5CE7',
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS apps (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT NOT NULL,
      slug            TEXT UNIQUE NOT NULL,
      short_desc_es   TEXT,
      short_desc_en   TEXT,
      description_es  TEXT,
      description_en  TEXT,
      logo_url        TEXT,
      url             TEXT NOT NULL,
      contact_email   TEXT,
      category_id     INTEGER REFERENCES categories(id),
      developer_id    INTEGER REFERENCES users(id),
      status          TEXT NOT NULL DEFAULT 'pending',
      featured        INTEGER DEFAULT 0,
      version         TEXT DEFAULT '1.0',
      platform        TEXT DEFAULT 'pwa',
      languages       TEXT DEFAULT '[]',
      tags            TEXT DEFAULT '[]',
      size_kb         INTEGER,
      privacy_url     TEXT,
      terms_url       TEXT,
      source_url      TEXT,
      pwa_installable INTEGER DEFAULT 0,
      has_offline     INTEGER DEFAULT 0,
      icons_zip_url   TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS screenshots (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id      INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
      url         TEXT NOT NULL,
      caption_es  TEXT,
      caption_en  TEXT,
      sort_order  INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS app_icons (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id    INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
      icon_type TEXT NOT NULL,
      url       TEXT NOT NULL,
      size      INTEGER
    );

    CREATE TABLE IF NOT EXISTS launcher_folders (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name       TEXT    NOT NULL,
      icon       TEXT    DEFAULT '📁',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS library (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      app_id     INTEGER NOT NULL REFERENCES apps(id)  ON DELETE CASCADE,
      folder_id  INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      added_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, app_id)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id     INTEGER NOT NULL REFERENCES apps(id)  ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rating     INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment    TEXT,
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(app_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_apps_status    ON apps(status);
    CREATE INDEX IF NOT EXISTS idx_apps_category  ON apps(category_id);
    CREATE INDEX IF NOT EXISTS idx_apps_developer ON apps(developer_id);
    CREATE INDEX IF NOT EXISTS idx_apps_featured  ON apps(featured);
    CREATE INDEX IF NOT EXISTS idx_library_user   ON library(user_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_app    ON reviews(app_id);
  `);

  // Búsqueda full-text (FTS5) sobre apps, sincronizada con triggers
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS apps_fts USING fts5(
        name, short_desc_es, short_desc_en, tags,
        content='apps', content_rowid='id'
      );
      CREATE TRIGGER IF NOT EXISTS apps_fts_ai AFTER INSERT ON apps BEGIN
        INSERT INTO apps_fts(rowid,name,short_desc_es,short_desc_en,tags)
        VALUES(new.id,new.name,new.short_desc_es,new.short_desc_en,new.tags);
      END;
      CREATE TRIGGER IF NOT EXISTS apps_fts_ad AFTER DELETE ON apps BEGIN
        INSERT INTO apps_fts(apps_fts,rowid,name,short_desc_es,short_desc_en,tags)
        VALUES('delete',old.id,old.name,old.short_desc_es,old.short_desc_en,old.tags);
      END;
      CREATE TRIGGER IF NOT EXISTS apps_fts_au AFTER UPDATE ON apps BEGIN
        INSERT INTO apps_fts(apps_fts,rowid,name,short_desc_es,short_desc_en,tags)
        VALUES('delete',old.id,old.name,old.short_desc_es,old.short_desc_en,old.tags);
        INSERT INTO apps_fts(rowid,name,short_desc_es,short_desc_en,tags)
        VALUES(new.id,new.name,new.short_desc_es,new.short_desc_en,new.tags);
      END;
    `);
    db.exec("INSERT INTO apps_fts(apps_fts) VALUES('rebuild');"); // poblar/resincronizar
    _ftsReady = true;
  } catch (e) {
    console.warn('⚠️  FTS5 no disponible, se usará búsqueda LIKE:', e.message);
    _ftsReady = false;
  }

  // Migración: añadir library.folder_id a DBs creadas antes de v1.3.0
  const libCols = db.prepare('PRAGMA table_info(library)').all().map(c => c.name);
  if (!libCols.includes('folder_id')) {
    db.exec('ALTER TABLE library ADD COLUMN folder_id INTEGER');
  }

  // Seed categories
  const catCount = db.prepare('SELECT COUNT(*) as c FROM categories').get().c;
  if (catCount === 0) {
    const ins = db.prepare('INSERT INTO categories(name_es,name_en,slug,icon,color,sort_order) VALUES(?,?,?,?,?,?)');
    [
      ['Productividad','Productivity','productivity','⚡','#6C5CE7',1],
      ['Educación','Education','education','📚','#00B894',2],
      ['Entretenimiento','Entertainment','entertainment','🎮','#E17055',3],
      ['Herramientas','Tools','tools','🔧','#0984E3',4],
      ['Redes sociales','Social','social','💬','#FD79A8',5],
      ['Finanzas','Finance','finance','💰','#FDCB6E',6],
      ['Salud','Health','health','❤️','#55EFC4',7],
      ['Noticias','News','news','📰','#636E72',8],
    ].forEach(r => ins.run(...r));
  }

  // Seed admin user
  const adminCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='admin'").get().c;
  if (adminCount === 0) {
    const pw   = process.env.ADMIN_PASSWORD || 'Admin1234!';
    const mail = process.env.ADMIN_EMAIL    || 'admin@wappstore.local';
    db.prepare('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)').run(
      'Admin', mail, bcrypt.hashSync(pw, 10), 'admin'
    );
    console.log(`   → Admin seeded: ${mail}`);
  }

  // ADMIN_RESET=1 → restablece (o crea) el admin desde el entorno, aunque ya exista.
  // Úsalo una vez para recuperar el acceso; luego quita la variable.
  if (['1', 'true', 'yes'].includes(String(process.env.ADMIN_RESET || '').toLowerCase())) {
    const pw   = process.env.ADMIN_PASSWORD || 'Admin1234!';
    const mail = process.env.ADMIN_EMAIL    || 'admin@wappstore.local';
    const hash = bcrypt.hashSync(pw, 10);
    const existing = db.prepare('SELECT id FROM users WHERE email=?').get(mail);
    if (existing) {
      db.prepare("UPDATE users SET password_hash=?, role='admin', active=1 WHERE email=?").run(hash, mail);
      console.log(`   → ADMIN_RESET: contraseña restablecida para ${mail}`);
    } else {
      db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES('Admin',?,?,'admin')").run(mail, hash);
      console.log(`   → ADMIN_RESET: admin creado ${mail}`);
    }
  }

  return db;
}

// ── Backup / restore ───────────────────────────────────────────────────────
// Snapshot consistente de la DB a un fichero destino (devuelve promesa).
function backupTo(dest) { return getDb().backup(dest); }

function closeDb() { if (_db) { try { _db.close(); } catch {} _db = null; } }

// Reemplaza la DB activa por la del fichero src y reabre + migra.
function restoreFrom(srcFile) {
  closeDb();
  for (const ext of ['', '-wal', '-shm']) {
    const f = DB_PATH + ext;
    if (fs.existsSync(f)) fs.rmSync(f);
  }
  fs.copyFileSync(srcFile, DB_PATH);
  return initDb();
}

module.exports = { getDb, initDb, backupTo, restoreFrom, closeDb, ftsReady, DB_PATH };
