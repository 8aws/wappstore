'use strict';
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../database');
const { requireAuth } = require('../middleware/auth');

// Cualquier usuario autenticado (client, developer, admin) tiene su launcher.
router.use(requireAuth());

/* ── Perfil ───────────────────────────────────────────────────────────────*/
// GET /api/me/profile
router.get('/profile', (req, res) => {
  const u = getDb().prepare('SELECT id,name,email,role,created_at FROM users WHERE id=?').get(req.user.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json(u);
});

// PUT /api/me/profile { name, email }
router.put('/profile', (req, res) => {
  const db = getDb();
  const name  = (req.body.name  || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  if (!name || !email) return res.status(400).json({ error: 'Name and email required' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Invalid email' });

  const clash = db.prepare('SELECT id FROM users WHERE email=? AND id<>?').get(email, req.user.id);
  if (clash) return res.status(409).json({ error: 'Email already in use' });

  db.prepare('UPDATE users SET name=?, email=? WHERE id=?').run(name, email, req.user.id);
  res.json({ id: req.user.id, name, email, role: req.user.role });
});

// PUT /api/me/password { current_password, new_password }
router.put('/password', (req, res) => {
  const db = getDb();
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: 'Current and new password required' });
  if (String(new_password).length < 6)     return res.status(400).json({ error: 'New password must be at least 6 characters' });

  const u = db.prepare('SELECT password_hash FROM users WHERE id=?').get(req.user.id);
  if (!u || !bcrypt.compareSync(current_password, u.password_hash))
    return res.status(401).json({ error: 'Current password is incorrect' });

  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(new_password, 10), req.user.id);
  res.json({ success: true });
});

/* ── Carpetas del launcher ────────────────────────────────────────────────*/
// GET /api/me/folders
router.get('/folders', (req, res) => {
  res.json(getDb().prepare('SELECT id,name,icon,sort_order FROM launcher_folders WHERE user_id=? ORDER BY sort_order,id').all(req.user.id));
});

// POST /api/me/folders { name, icon }
router.post('/folders', (req, res) => {
  const db   = getDb();
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Folder name required' });
  const max = db.prepare('SELECT COALESCE(MAX(sort_order),-1) AS m FROM launcher_folders WHERE user_id=?').get(req.user.id).m;
  const r = db.prepare('INSERT INTO launcher_folders(user_id,name,icon,sort_order) VALUES(?,?,?,?)')
              .run(req.user.id, name, (req.body.icon || '📁').slice(0, 4), max + 1);
  res.status(201).json(db.prepare('SELECT id,name,icon,sort_order FROM launcher_folders WHERE id=?').get(r.lastInsertRowid));
});

// PUT /api/me/folders/reorder { order: [folderId, ...] }  (antes que /:id)
router.put('/folders/reorder', (req, res) => {
  const order = Array.isArray(req.body.order) ? req.body.order : [];
  const db = getDb();
  const stmt = db.prepare('UPDATE launcher_folders SET sort_order=? WHERE user_id=? AND id=?');
  db.transaction(ids => ids.forEach((id, i) => stmt.run(i, req.user.id, parseInt(id, 10))))(order);
  res.json({ success: true });
});

// PUT /api/me/folders/:id { name, icon, sort_order }
router.put('/folders/:id', (req, res) => {
  const db = getDb();
  const f  = db.prepare('SELECT id FROM launcher_folders WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!f) return res.status(404).json({ error: 'Folder not found' });
  db.prepare('UPDATE launcher_folders SET name=COALESCE(?,name), icon=COALESCE(?,icon), sort_order=COALESCE(?,sort_order) WHERE id=?')
    .run(req.body.name?.trim() || null, req.body.icon || null, req.body.sort_order ?? null, req.params.id);
  res.json(db.prepare('SELECT id,name,icon,sort_order FROM launcher_folders WHERE id=?').get(req.params.id));
});

// DELETE /api/me/folders/:id  (las apps vuelven a "sin carpeta")
router.delete('/folders/:id', (req, res) => {
  const db = getDb();
  if (!db.prepare('SELECT id FROM launcher_folders WHERE id=? AND user_id=?').get(req.params.id, req.user.id))
    return res.status(404).json({ error: 'Folder not found' });
  db.prepare('UPDATE library SET folder_id=NULL WHERE user_id=? AND folder_id=?').run(req.user.id, req.params.id);
  db.prepare('DELETE FROM launcher_folders WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

/* ── Biblioteca / launcher ────────────────────────────────────────────────*/
// GET /api/me/library
router.get('/library', (req, res) => {
  const rows = getDb().prepare(`
    SELECT l.app_id AS id, l.sort_order, l.folder_id, l.added_at,
           a.name, a.slug, a.url, a.logo_url, a.short_desc_es, a.short_desc_en, a.platform
    FROM library l
    JOIN apps a ON a.id = l.app_id
    WHERE l.user_id = ? AND a.status = 'approved'
    ORDER BY l.sort_order, l.added_at
  `).all(req.user.id);
  res.json(rows);
});

// POST /api/me/library { app_id }
router.post('/library', (req, res) => {
  const db    = getDb();
  const appId = parseInt(req.body.app_id, 10);
  if (!appId) return res.status(400).json({ error: 'app_id required' });
  const app = db.prepare("SELECT id FROM apps WHERE id=? AND status='approved'").get(appId);
  if (!app) return res.status(404).json({ error: 'App not found or not approved' });
  const max = db.prepare('SELECT COALESCE(MAX(sort_order),-1) AS m FROM library WHERE user_id=?').get(req.user.id).m;
  db.prepare('INSERT OR IGNORE INTO library(user_id,app_id,sort_order) VALUES(?,?,?)').run(req.user.id, appId, max + 1);
  res.status(201).json({ success: true });
});

// DELETE /api/me/library/:appId
router.delete('/library/:appId', (req, res) => {
  getDb().prepare('DELETE FROM library WHERE user_id=? AND app_id=?').run(req.user.id, parseInt(req.params.appId, 10));
  res.json({ success: true });
});

// PUT /api/me/library/reorder { order: [appId, ...] }
router.put('/library/reorder', (req, res) => {
  const order = Array.isArray(req.body.order) ? req.body.order : [];
  const db = getDb();
  const stmt = db.prepare('UPDATE library SET sort_order=? WHERE user_id=? AND app_id=?');
  db.transaction(ids => ids.forEach((id, i) => stmt.run(i, req.user.id, parseInt(id, 10))))(order);
  res.json({ success: true });
});

// PUT /api/me/library/:appId/folder { folder_id }  (null = sin carpeta)
router.put('/library/:appId/folder', (req, res) => {
  const db = getDb();
  let folderId = req.body.folder_id;
  folderId = (folderId === null || folderId === '' || folderId === undefined) ? null : parseInt(folderId, 10);
  if (folderId !== null && !db.prepare('SELECT id FROM launcher_folders WHERE id=? AND user_id=?').get(folderId, req.user.id))
    return res.status(404).json({ error: 'Folder not found' });
  const r = db.prepare('UPDATE library SET folder_id=? WHERE user_id=? AND app_id=?')
              .run(folderId, req.user.id, parseInt(req.params.appId, 10));
  if (!r.changes) return res.status(404).json({ error: 'App not in library' });
  res.json({ success: true });
});

/* ── Reseñas / valoraciones ───────────────────────────────────────────────*/
// GET /api/me/reviews/:appId — mi reseña de una app (para precargar)
router.get('/reviews/:appId', (req, res) => {
  const r = getDb().prepare('SELECT id,rating,comment FROM reviews WHERE app_id=? AND user_id=?')
              .get(parseInt(req.params.appId, 10), req.user.id);
  res.json(r || null);
});

// POST /api/me/reviews { app_id, rating, comment } — crea o actualiza
router.post('/reviews', (req, res) => {
  const db     = getDb();
  const appId  = parseInt(req.body.app_id, 10);
  const rating = parseInt(req.body.rating, 10);
  const comment = (req.body.comment || '').toString().slice(0, 2000);
  if (!appId || !(rating >= 1 && rating <= 5)) return res.status(400).json({ error: 'app_id and rating (1-5) required' });
  if (!db.prepare("SELECT id FROM apps WHERE id=? AND status='approved'").get(appId))
    return res.status(404).json({ error: 'App not found or not approved' });

  db.prepare(`
    INSERT INTO reviews(app_id,user_id,rating,comment) VALUES(?,?,?,?)
    ON CONFLICT(app_id,user_id) DO UPDATE SET rating=excluded.rating, comment=excluded.comment, created_at=datetime('now')
  `).run(appId, req.user.id, rating, comment);
  res.status(201).json({ success: true });
});

// DELETE /api/me/reviews/:appId
router.delete('/reviews/:appId', (req, res) => {
  getDb().prepare('DELETE FROM reviews WHERE app_id=? AND user_id=?').run(parseInt(req.params.appId, 10), req.user.id);
  res.json({ success: true });
});

module.exports = router;
