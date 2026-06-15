'use strict';
const router = require('express').Router();
const multer = require('multer');
const sharp  = require('sharp');
const path   = require('path');
const fs     = require('fs');
const { getDb } = require('../database');
const { requireAuth } = require('../middleware/auth');
const { assertPublicUrl } = require('../utils/validate');
const { generateIcons, processScreenshot } = require('../utils/icons');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

// Procesa un fichero como logo de la app: 512×512 PNG + genera todos los iconos.
async function applyLogo(db, app, srcPath) {
  const logoDir = path.join(UPLOAD_DIR, 'logos', app.slug);
  fs.mkdirSync(logoDir, { recursive: true });
  const logoPath = path.join(logoDir, 'logo.png');

  await sharp(srcPath)
    .resize(512, 512, { fit: 'contain', background: { r:0, g:0, b:0, alpha:0 } })
    .png()
    .toFile(logoPath);

  const logoUrl = `/uploads/logos/${app.slug}/logo.png`;
  db.prepare("UPDATE apps SET logo_url=?,updated_at=datetime('now') WHERE id=?").run(logoUrl, app.id);

  const result = await generateIcons(logoPath, app.slug);
  db.prepare('DELETE FROM app_icons WHERE app_id=?').run(app.id);
  const ins = db.prepare('INSERT INTO app_icons(app_id,icon_type,url,size) VALUES(?,?,?,?)');
  result.icons.forEach(i => ins.run(app.id, i.name, i.url, i.size));
  ins.run(app.id, 'favicon.ico', `/uploads/icons/${app.slug}/favicon.ico`, 0);
  db.prepare('UPDATE apps SET icons_zip_url=? WHERE id=?').run(result.zip_url, app.id);

  return { logo_url: logoUrl, ...result };
}

const tempStorage = multer.diskStorage({
  destination: (_, __, cb) => {
    const d = path.join(UPLOAD_DIR, 'temp');
    fs.mkdirSync(d, { recursive: true });
    cb(null, d);
  },
  filename: (_, file, cb) =>
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname).toLowerCase()}`),
});

const upload = multer({
  storage: tempStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ok = ['.jpg','.jpeg','.png','.gif','.webp','.svg'];
    cb(null, ok.includes(path.extname(file.originalname).toLowerCase()));
  },
});

router.use(requireAuth(['developer','admin']));

function getApp(db, appId, userId, role) {
  return role === 'admin'
    ? db.prepare('SELECT * FROM apps WHERE id=?').get(appId)
    : db.prepare('SELECT * FROM apps WHERE id=? AND developer_id=?').get(appId, userId);
}

// POST /api/upload/logo/:appId
router.post('/logo/:appId', upload.single('logo'), async (req, res) => {
  const tmpPath = req.file?.path;
  try {
    const db  = getDb();
    const app = getApp(db, req.params.appId, req.user.id, req.user.role);
    if (!app)      return res.status(404).json({ error: 'App not found' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const result = await applyLogo(db, app, tmpPath);
    fs.unlinkSync(tmpPath);
    res.json(result);
  } catch (err) {
    console.error('Logo upload error:', err);
    if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/upload/logo-url/:appId { url } — descarga un icono remoto como logo
router.post('/logo-url/:appId', async (req, res) => {
  let tmpPath;
  try {
    const db  = getDb();
    const app = getApp(db, req.params.appId, req.user.id, req.user.role);
    if (!app) return res.status(404).json({ error: 'App not found' });

    const url = await assertPublicUrl(req.body.url || '');
    const resp = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return res.status(400).json({ error: `No se pudo descargar el icono (HTTP ${resp.status})` });
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length > 15 * 1024 * 1024) return res.status(400).json({ error: 'Icono demasiado grande' });

    tmpPath = path.join(UPLOAD_DIR, 'temp', `dl-${Date.now()}.img`);
    fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
    fs.writeFileSync(tmpPath, buf);

    const result = await applyLogo(db, app, tmpPath);
    fs.unlinkSync(tmpPath);
    res.json(result);
  } catch (err) {
    if (tmpPath && fs.existsSync(tmpPath)) { try { fs.unlinkSync(tmpPath); } catch {} }
    res.status(400).json({ error: err.message });
  }
});

// POST /api/upload/screenshot/:appId
router.post('/screenshot/:appId', upload.array('screenshots', 10), async (req, res) => {
  const files = req.files || [];
  try {
    const db  = getDb();
    const app = getApp(db, req.params.appId, req.user.id, req.user.role);
    if (!app)           return res.status(404).json({ error: 'App not found' });
    if (!files.length)  return res.status(400).json({ error: 'No files uploaded' });

    const base  = db.prepare('SELECT COUNT(*) as c FROM screenshots WHERE app_id=?').get(app.id).c;
    const saved = [];

    for (let i = 0; i < files.length; i++) {
      const filename = `ss-${Date.now()}-${i}.jpg`;
      const url = await processScreenshot(files[i].path, app.slug, filename);
      fs.unlinkSync(files[i].path);
      const r = db.prepare('INSERT INTO screenshots(app_id,url,sort_order) VALUES(?,?,?)').run(app.id, url, base + i);
      saved.push({ id: r.lastInsertRowid, url, sort_order: base + i });
    }
    res.json({ screenshots: saved });
  } catch (err) {
    console.error('Screenshot upload error:', err);
    files.forEach(f => { try { fs.unlinkSync(f.path); } catch {} });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/upload/icons/:appId/download  (any authenticated user)
router.get('/icons/:appId/download', requireAuth(), (req, res) => {
  const db  = getDb();
  const app = db.prepare('SELECT slug,icons_zip_url FROM apps WHERE id=?').get(req.params.appId);
  if (!app?.icons_zip_url) return res.status(404).json({ error: 'Icons not generated yet' });
  const zipPath = path.join(__dirname, '..', '..', app.icons_zip_url.replace(/^\//,''));
  if (!fs.existsSync(zipPath)) return res.status(404).json({ error: 'ZIP file missing' });
  res.download(zipPath, `${app.slug}-icons.zip`);
});

module.exports = router;
