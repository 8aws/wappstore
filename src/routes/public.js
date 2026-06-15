'use strict';
const router = require('express').Router();
const { getDb, ftsReady } = require('../database');

function ratingOf(db, appId) {
  const r = db.prepare('SELECT COUNT(*) AS n, ROUND(AVG(rating),2) AS avg FROM reviews WHERE app_id=?').get(appId);
  return { rating_count: r.n, rating_avg: r.n ? r.avg : 0 };
}

function parseApp(app, lang, db) {
  return {
    ...app,
    short_desc:  lang === 'en' ? (app.short_desc_en  || app.short_desc_es)  : (app.short_desc_es  || app.short_desc_en),
    description: lang === 'en' ? (app.description_en || app.description_es) : (app.description_es || app.description_en),
    tags:      JSON.parse(app.tags      || '[]'),
    languages: JSON.parse(app.languages || '[]'),
    ...ratingOf(db, app.id),
    category: app.category_id
      ? db.prepare('SELECT * FROM categories WHERE id=?').get(app.category_id)
      : null,
  };
}

// Convierte el texto de búsqueda en una consulta FTS5 segura (prefijos)
function ftsQuery(search) {
  return String(search).replace(/["*]/g, ' ').trim().split(/\s+/).filter(Boolean)
    .map(t => `"${t}"*`).join(' ');
}

// GET /api/public/apps
router.get('/apps', (req, res) => {
  const db = getDb();
  const { search, category, featured, limit = 24, offset = 0, lang = 'es' } = req.query;

  let from = 'apps a';
  let where = "a.status='approved'";
  const params = [];
  let order = 'a.featured DESC, a.created_at DESC';

  // Búsqueda: FTS5 si está disponible, con respaldo a LIKE
  const useFts = search && ftsReady();
  if (useFts) {
    const q = ftsQuery(search);
    if (q) {
      from = 'apps a JOIN apps_fts f ON f.rowid = a.id';
      where += ' AND apps_fts MATCH ?';
      params.push(q);
      order = 'a.featured DESC, bm25(apps_fts)';
    }
  } else if (search) {
    where += ' AND (a.name LIKE ? OR a.short_desc_es LIKE ? OR a.short_desc_en LIKE ? OR a.tags LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  if (category) {
    const cat = db.prepare('SELECT id FROM categories WHERE slug=?').get(category);
    if (cat) { where += ' AND a.category_id=?'; params.push(cat.id); }
  }
  if (featured === 'true') { where += ' AND a.featured=1'; }

  let apps, total;
  try {
    apps  = db.prepare(`SELECT a.* FROM ${from} WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`)
              .all(...params, +limit, +offset);
    total = db.prepare(`SELECT COUNT(*) as c FROM ${from} WHERE ${where}`).get(...params).c;
  } catch (e) {
    // Si la consulta FTS falla (sintaxis), devolvemos vacío en vez de 500
    return res.json({ apps: [], total: 0 });
  }

  res.json({ apps: apps.map(a => parseApp(a, lang, db)), total });
});

// GET /api/public/apps/:slug
router.get('/apps/:slug', (req, res) => {
  const db  = getDb();
  const lang = req.query.lang || 'es';
  const app  = db.prepare("SELECT * FROM apps WHERE slug=? AND status='approved'").get(req.params.slug);
  if (!app) return res.status(404).json({ error: 'App not found' });

  const screenshots = db.prepare('SELECT * FROM screenshots WHERE app_id=? ORDER BY sort_order').all(app.id);
  const icons       = db.prepare('SELECT * FROM app_icons WHERE app_id=?').all(app.id);
  const developer   = db.prepare('SELECT id,name,email FROM users WHERE id=?').get(app.developer_id);
  const reviews     = db.prepare(`
    SELECT r.id, r.rating, r.comment, r.created_at, u.name AS user_name
    FROM reviews r JOIN users u ON u.id = r.user_id
    WHERE r.app_id=? ORDER BY r.created_at DESC LIMIT 100
  `).all(app.id);

  res.json({ ...parseApp(app, lang, db), screenshots, icons, developer, reviews });
});

// GET /api/public/categories
router.get('/categories', (req, res) => {
  const db   = getDb();
  const lang = req.query.lang || 'es';
  const cats = db.prepare('SELECT * FROM categories ORDER BY sort_order,id').all();
  res.json(cats.map(c => ({
    ...c,
    name: lang === 'en' ? c.name_en : c.name_es,
    app_count: db.prepare("SELECT COUNT(*) as c FROM apps WHERE category_id=? AND status='approved'").get(c.id).c,
  })));
});

// GET /api/public/stats
router.get('/stats', (req, res) => {
  const db = getDb();
  res.json({
    total_apps:    db.prepare("SELECT COUNT(*) as c FROM apps WHERE status='approved'").get().c,
    total_cats:    db.prepare('SELECT COUNT(*) as c FROM categories').get().c,
    total_devs:    db.prepare("SELECT COUNT(*) as c FROM users WHERE role='developer'").get().c,
  });
});

module.exports = router;
