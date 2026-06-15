'use strict';
const router = require('express').Router();
const { getDb } = require('../database');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth(['developer', 'admin']));

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g,'').replace(/[\s_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
}
function parseTags(v) {
  if (!v) return '[]';
  if (Array.isArray(v)) return JSON.stringify(v.map(t=>t.trim()).filter(Boolean));
  return JSON.stringify(v.split(',').map(t=>t.trim()).filter(Boolean));
}

// GET /api/developer/apps
router.get('/apps', (req, res) => {
  const db = getDb();
  const apps = db.prepare(`
    SELECT a.*, c.name_es as cat_es, c.name_en as cat_en, c.icon as cat_icon, c.color as cat_color
    FROM apps a LEFT JOIN categories c ON a.category_id=c.id
    WHERE a.developer_id=? ORDER BY a.created_at DESC
  `).all(req.user.id);
  res.json(apps.map(a => ({ ...a, tags: JSON.parse(a.tags||'[]'), languages: JSON.parse(a.languages||'[]') })));
});

// GET /api/developer/apps/:id
router.get('/apps/:id', (req, res) => {
  const db  = getDb();
  const app = db.prepare('SELECT * FROM apps WHERE id=? AND developer_id=?').get(req.params.id, req.user.id);
  if (!app) return res.status(404).json({ error: 'App not found' });
  const screenshots = db.prepare('SELECT * FROM screenshots WHERE app_id=? ORDER BY sort_order').all(app.id);
  const icons       = db.prepare('SELECT * FROM app_icons WHERE app_id=?').all(app.id);
  res.json({ ...app, tags: JSON.parse(app.tags||'[]'), languages: JSON.parse(app.languages||'[]'), screenshots, icons });
});

// POST /api/developer/apps
router.post('/apps', (req, res) => {
  const db  = getDb();
  const { name, short_desc_es, short_desc_en, description_es, description_en,
          url, contact_email, category_id, version, platform, tags, languages,
          size_kb, privacy_url, terms_url, source_url, pwa_installable, has_offline } = req.body;

  if (!name || !url) return res.status(400).json({ error: 'Name and URL are required' });

  let slug = slugify(name);
  if (db.prepare('SELECT id FROM apps WHERE slug=?').get(slug)) slug += '-' + Date.now();

  const r = db.prepare(`
    INSERT INTO apps(name,slug,short_desc_es,short_desc_en,description_es,description_en,
      url,contact_email,category_id,developer_id,version,platform,tags,languages,
      size_kb,privacy_url,terms_url,source_url,pwa_installable,has_offline,status)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending')
  `).run(name,slug,short_desc_es||null,short_desc_en||null,description_es||null,description_en||null,
         url,contact_email||null,category_id||null,req.user.id,version||'1.0',platform||'pwa',
         parseTags(tags),parseTags(languages),size_kb||null,privacy_url||null,terms_url||null,source_url||null,
         pwa_installable?1:0,has_offline?1:0);

  const app = db.prepare('SELECT * FROM apps WHERE id=?').get(r.lastInsertRowid);
  res.status(201).json({ ...app, tags: JSON.parse(app.tags), languages: JSON.parse(app.languages) });
});

// PUT /api/developer/apps/:id
router.put('/apps/:id', (req, res) => {
  const db  = getDb();
  const app = db.prepare('SELECT id FROM apps WHERE id=? AND developer_id=?').get(req.params.id, req.user.id);
  if (!app) return res.status(404).json({ error: 'App not found' });

  const f = req.body;
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
      status='pending', updated_at=datetime('now')
    WHERE id=? AND developer_id=?
  `).run(f.name,f.short_desc_es,f.short_desc_en,f.description_es,f.description_en,
         f.url,f.contact_email,f.category_id||null,f.version,f.platform,
         f.tags?parseTags(f.tags):null, f.languages?parseTags(f.languages):null,
         f.size_kb||null,f.privacy_url,f.terms_url,f.source_url,
         f.pwa_installable!=null?(f.pwa_installable?1:0):null,
         f.has_offline!=null?(f.has_offline?1:0):null,
         req.params.id, req.user.id);

  const updated = db.prepare('SELECT * FROM apps WHERE id=?').get(req.params.id);
  res.json({ ...updated, tags: JSON.parse(updated.tags), languages: JSON.parse(updated.languages) });
});

// DELETE /api/developer/apps/:id
router.delete('/apps/:id', (req, res) => {
  const db = getDb();
  if (!db.prepare('SELECT id FROM apps WHERE id=? AND developer_id=?').get(req.params.id, req.user.id))
    return res.status(404).json({ error: 'App not found' });
  db.prepare('DELETE FROM apps WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// DELETE /api/developer/screenshots/:id
router.delete('/screenshots/:id', (req, res) => {
  const db = getDb();
  const ss = db.prepare(`
    SELECT s.* FROM screenshots s JOIN apps a ON s.app_id=a.id WHERE s.id=? AND a.developer_id=?
  `).get(req.params.id, req.user.id);
  if (!ss) return res.status(404).json({ error: 'Screenshot not found' });
  db.prepare('DELETE FROM screenshots WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
