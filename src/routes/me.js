'use strict';
const router = require('express').Router();
const { getDb } = require('../database');
const { requireAuth } = require('../middleware/auth');

// Cualquier usuario autenticado (client, developer, admin) tiene su launcher.
router.use(requireAuth());

// GET /api/me/library — apps guardadas por el usuario, listas para lanzar
router.get('/library', (req, res) => {
  const rows = getDb().prepare(`
    SELECT l.app_id AS id, l.sort_order, l.added_at,
           a.name, a.slug, a.url, a.logo_url, a.short_desc_es, a.short_desc_en, a.platform
    FROM library l
    JOIN apps a ON a.id = l.app_id
    WHERE l.user_id = ? AND a.status = 'approved'
    ORDER BY l.sort_order, l.added_at
  `).all(req.user.id);
  res.json(rows);
});

// POST /api/me/library { app_id } — añadir al launcher
router.post('/library', (req, res) => {
  const db    = getDb();
  const appId = parseInt(req.body.app_id, 10);
  if (!appId) return res.status(400).json({ error: 'app_id required' });

  const app = db.prepare("SELECT id FROM apps WHERE id=? AND status='approved'").get(appId);
  if (!app) return res.status(404).json({ error: 'App not found or not approved' });

  const max = db.prepare('SELECT COALESCE(MAX(sort_order),-1) AS m FROM library WHERE user_id=?').get(req.user.id).m;
  db.prepare('INSERT OR IGNORE INTO library(user_id,app_id,sort_order) VALUES(?,?,?)')
    .run(req.user.id, appId, max + 1);

  res.status(201).json({ success: true });
});

// DELETE /api/me/library/:appId — quitar del launcher
router.delete('/library/:appId', (req, res) => {
  getDb().prepare('DELETE FROM library WHERE user_id=? AND app_id=?')
    .run(req.user.id, parseInt(req.params.appId, 10));
  res.json({ success: true });
});

// PUT /api/me/library/reorder { order: [appId, ...] } — reordenar tiles
router.put('/library/reorder', (req, res) => {
  const order = Array.isArray(req.body.order) ? req.body.order : [];
  const db = getDb();
  const stmt = db.prepare('UPDATE library SET sort_order=? WHERE user_id=? AND app_id=?');
  const tx = db.transaction(ids => ids.forEach((id, i) => stmt.run(i, req.user.id, parseInt(id, 10))));
  tx(order);
  res.json({ success: true });
});

module.exports = router;
