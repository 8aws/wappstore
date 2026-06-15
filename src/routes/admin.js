'use strict';
const router = require('express').Router();
const multer = require('multer');
const bcrypt = require('bcryptjs');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');
const Database = require('better-sqlite3');
const { getDb, backupTo, restoreFrom } = require('../database');
const { requireAuth } = require('../middleware/auth');
const { isHttpUrl } = require('../utils/validate');

const dbUpload = multer({ dest: os.tmpdir(), limits: { fileSize: 200 * 1024 * 1024 } });

router.use(requireAuth(['admin']));

function badUrls(body) {
  for (const f of ['url', 'privacy_url', 'terms_url', 'source_url']) {
    if (body[f] != null && body[f] !== '' && !isHttpUrl(body[f])) {
      return `Invalid ${f}: must be a valid http(s) URL`;
    }
  }
  return null;
}

function parseTags(v) {
  if (!v) return null;
  if (Array.isArray(v)) return JSON.stringify(v.map(t=>t.trim()).filter(Boolean));
  return JSON.stringify(v.split(',').map(t=>t.trim()).filter(Boolean));
}

// ── Stats ─────────────────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  const db = getDb();
  res.json({
    total_apps:    db.prepare('SELECT COUNT(*) as c FROM apps').get().c,
    pending_apps:  db.prepare("SELECT COUNT(*) as c FROM apps WHERE status='pending'").get().c,
    approved_apps: db.prepare("SELECT COUNT(*) as c FROM apps WHERE status='approved'").get().c,
    total_users:   db.prepare('SELECT COUNT(*) as c FROM users').get().c,
    developers:    db.prepare("SELECT COUNT(*) as c FROM users WHERE role='developer'").get().c,
  });
});

// ── Apps ──────────────────────────────────────────────────────────────────
router.get('/apps', (req, res) => {
  const db = getDb();
  const { status, limit = 50, offset = 0 } = req.query;
  const where  = status ? "a.status=?" : "1=1";
  const params = status ? [status] : [];
  const apps   = db.prepare(`
    SELECT a.*, u.name as dev_name, u.email as dev_email,
           c.name_es as cat_es, c.name_en as cat_en
    FROM apps a
    LEFT JOIN users u ON a.developer_id=u.id
    LEFT JOIN categories c ON a.category_id=c.id
    WHERE ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, +limit, +offset);
  const total = db.prepare(`SELECT COUNT(*) as c FROM apps a WHERE ${where}`).get(...params).c;
  res.json({ apps: apps.map(a=>({...a, tags: JSON.parse(a.tags||'[]')})), total });
});

router.put('/apps/:id/status', (req, res) => {
  const { status } = req.body;
  if (!['pending','approved','rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  getDb().prepare("UPDATE apps SET status=?,updated_at=datetime('now') WHERE id=?").run(status, req.params.id);
  res.json({ success: true });
});

router.put('/apps/:id/featured', (req, res) => {
  getDb().prepare('UPDATE apps SET featured=? WHERE id=?').run(req.body.featured?1:0, req.params.id);
  res.json({ success: true });
});

router.put('/apps/:id', (req, res) => {
  const db = getDb();
  const urlErr = badUrls(req.body);
  if (urlErr) return res.status(400).json({ error: urlErr });
  const f  = req.body;
  db.prepare(`
    UPDATE apps SET
      name=COALESCE(?,name), short_desc_es=COALESCE(?,short_desc_es), short_desc_en=COALESCE(?,short_desc_en),
      description_es=COALESCE(?,description_es), description_en=COALESCE(?,description_en),
      url=COALESCE(?,url), contact_email=COALESCE(?,contact_email), category_id=COALESCE(?,category_id),
      version=COALESCE(?,version), platform=COALESCE(?,platform),
      tags=COALESCE(?,tags), languages=COALESCE(?,languages),
      size_kb=COALESCE(?,size_kb), privacy_url=COALESCE(?,privacy_url),
      terms_url=COALESCE(?,terms_url), source_url=COALESCE(?,source_url),
      pwa_installable=COALESCE(?,pwa_installable), has_offline=COALESCE(?,has_offline),
      featured=COALESCE(?,featured), updated_at=datetime('now')
    WHERE id=?
  `).run(f.name,f.short_desc_es,f.short_desc_en,f.description_es,f.description_en,
         f.url,f.contact_email,f.category_id||null,f.version,f.platform,
         f.tags?parseTags(f.tags):null, f.languages?parseTags(f.languages):null,
         f.size_kb||null,f.privacy_url,f.terms_url,f.source_url,
         f.pwa_installable!=null?(f.pwa_installable?1:0):null,
         f.has_offline!=null?(f.has_offline?1:0):null,
         f.featured!=null?(f.featured?1:0):null,
         req.params.id);
  const updated = db.prepare('SELECT * FROM apps WHERE id=?').get(req.params.id);
  res.json({ ...updated, tags: JSON.parse(updated.tags||'[]') });
});

router.delete('/apps/:id', (req, res) => {
  getDb().prepare('DELETE FROM apps WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── Users ─────────────────────────────────────────────────────────────────
router.get('/users', (req, res) => {
  const users = getDb().prepare(`
    SELECT id,name,email,role,active,created_at,
           (SELECT COUNT(*) FROM apps WHERE developer_id=users.id) as app_count
    FROM users ORDER BY created_at DESC
  `).all();
  res.json(users);
});

router.put('/users/:id', (req, res) => {
  const db = getDb();
  const { role, active } = req.body;
  if (role && !['client','developer','admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (role)           db.prepare('UPDATE users SET role=? WHERE id=?').run(role, req.params.id);
  if (active != null) db.prepare('UPDATE users SET active=? WHERE id=?').run(active?1:0, req.params.id);
  res.json({ success: true });
});

// PUT /api/admin/users/:id/password { new_password } — el admin resetea a cualquiera
router.put('/users/:id/password', (req, res) => {
  const pw = (req.body.new_password || '').toString();
  if (pw.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const db = getDb();
  const u = db.prepare('SELECT id FROM users WHERE id=?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(pw, 10), req.params.id);
  res.json({ success: true });
});

router.delete('/users/:id', (req, res) => {
  if (+req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  getDb().prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── Categories ────────────────────────────────────────────────────────────
router.get('/categories', (req, res) => res.json(getDb().prepare('SELECT * FROM categories ORDER BY sort_order,id').all()));

router.post('/categories', (req, res) => {
  const db = getDb();
  const { name_es, name_en, icon, color, sort_order } = req.body;
  if (!name_es || !name_en) return res.status(400).json({ error: 'Names required' });
  const slug = name_en.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const r = db.prepare('INSERT INTO categories(name_es,name_en,slug,icon,color,sort_order) VALUES(?,?,?,?,?,?)')
              .run(name_es, name_en, slug, icon||'📦', color||'#6C5CE7', sort_order||0);
  res.status(201).json(db.prepare('SELECT * FROM categories WHERE id=?').get(r.lastInsertRowid));
});

router.put('/categories/:id', (req, res) => {
  const db = getDb();
  const { name_es, name_en, icon, color, sort_order } = req.body;
  db.prepare('UPDATE categories SET name_es=COALESCE(?,name_es),name_en=COALESCE(?,name_en),icon=COALESCE(?,icon),color=COALESCE(?,color),sort_order=COALESCE(?,sort_order) WHERE id=?')
    .run(name_es, name_en, icon, color, sort_order, req.params.id);
  res.json(db.prepare('SELECT * FROM categories WHERE id=?').get(req.params.id));
});

router.delete('/categories/:id', (req, res) => {
  getDb().prepare('DELETE FROM categories WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── Screenshots (admin) ───────────────────────────────────────────────────
router.delete('/screenshots/:id', (req, res) => {
  getDb().prepare('DELETE FROM screenshots WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── Backup / restore de la base de datos ──────────────────────────────────
// GET /api/admin/backup → descarga un snapshot consistente del .db
router.get('/backup', async (req, res) => {
  const tmp = path.join(os.tmpdir(), `wappstore-backup-${Date.now()}.db`);
  try {
    await backupTo(tmp);
    const name = `wappstore-${new Date().toISOString().slice(0,10)}.db`;
    res.download(tmp, name, () => { try { fs.rmSync(tmp); } catch {} });
  } catch (e) {
    try { fs.rmSync(tmp); } catch {}
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/restore (multipart, campo 'db') → reemplaza la DB
router.post('/restore', dbUpload.single('db'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const tmp = req.file.path;
  try {
    // Valida que sea una DB SQLite válida con la tabla users
    const test = new Database(tmp, { readonly: true });
    const ok = test.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    test.close();
    if (!ok) { fs.rmSync(tmp); return res.status(400).json({ error: 'El fichero no es una base de datos WAppStore válida' }); }

    restoreFrom(tmp);
    fs.rmSync(tmp);
    res.json({ success: true });
  } catch (e) {
    try { fs.rmSync(tmp); } catch {}
    res.status(400).json({ error: 'Restore failed: ' + e.message });
  }
});

module.exports = router;
