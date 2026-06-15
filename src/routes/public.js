'use strict';
const router = require('express').Router();
const { getDb } = require('../database');

function parseApp(app, lang, db) {
  return {
    ...app,
    short_desc:  lang === 'en' ? (app.short_desc_en  || app.short_desc_es)  : (app.short_desc_es  || app.short_desc_en),
    description: lang === 'en' ? (app.description_en || app.description_es) : (app.description_es || app.description_en),
    tags:      JSON.parse(app.tags      || '[]'),
    languages: JSON.parse(app.languages || '[]'),
    category: app.category_id
      ? db.prepare('SELECT * FROM categories WHERE id=?').get(app.category_id)
      : null,
  };
}

// GET /api/public/apps
router.get('/apps', (req, res) => {
  const db = getDb();
  const { search, category, featured, limit = 24, offset = 0, lang = 'es' } = req.query;

  let where = "status='approved'";
  const params = [];

  if (search) {
    where += ' AND (name LIKE ? OR short_desc_es LIKE ? OR short_desc_en LIKE ? OR tags LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  if (category) {
    const cat = db.prepare('SELECT id FROM categories WHERE slug=?').get(category);
    if (cat) { where += ' AND category_id=?'; params.push(cat.id); }
  }
  if (featured === 'true') { where += ' AND featured=1'; }

  const apps  = db.prepare(`SELECT * FROM apps WHERE ${where} ORDER BY featured DESC, created_at DESC LIMIT ? OFFSET ?`)
                  .all(...params, +limit, +offset);
  const total = db.prepare(`SELECT COUNT(*) as c FROM apps WHERE ${where}`).get(...params).c;

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

  res.json({ ...parseApp(app, lang, db), screenshots, icons, developer });
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
