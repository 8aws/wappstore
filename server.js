'use strict';
const express = require('express');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── JWT secret ─────────────────────────────────────────────────────────────
const DEV_SECRET = 'wappstore-dev-secret-change-in-prod';
global.JWT_SECRET = process.env.JWT_SECRET || DEV_SECRET;
if (process.env.NODE_ENV === 'production' &&
    (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEV_SECRET)) {
  console.error('❌ JWT_SECRET no configurado en producción. Genéralo con: openssl rand -base64 48');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production' &&
    (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'Admin1234!')) {
  console.warn('⚠️  ADMIN_PASSWORD usa el valor por defecto. Cámbialo cuanto antes.');
}

// ── Directories ────────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, 'uploads');
['temp','logos','screenshots','icons'].forEach(d =>
  fs.mkdirSync(path.join(UPLOAD_DIR, d), { recursive: true })
);
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });

// ── Init DB ────────────────────────────────────────────────────────────────
const { initDb } = require('./src/database');
initDb();

// ── Middleware ─────────────────────────────────────────────────────────────
const { securityHeaders } = require('./src/middleware/security');
app.set('trust proxy', 1); // detrás del reverse proxy de ZimaOS / Cosmos
app.use(securityHeaders);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Static ─────────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

// ── API Routes ─────────────────────────────────────────────────────────────
app.use('/api/public',    require('./src/routes/public'));
app.use('/api/auth',      require('./src/routes/auth'));
app.use('/api/me',        require('./src/routes/me'));
app.use('/api/developer', require('./src/routes/developer'));
app.use('/api/admin',     require('./src/routes/admin'));
app.use('/api/upload',    require('./src/routes/upload'));

// ── SPA Fallback ───────────────────────────────────────────────────────────
app.use((req, res) => {
  const file = path.join(__dirname, 'public', req.path);
  if (req.path.endsWith('.html') && fs.existsSync(file)) return res.sendFile(file);
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Error Handler ──────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ WAppStore → http://0.0.0.0:${PORT}`);
  console.log(`   Admin: ${process.env.ADMIN_EMAIL || 'admin@wappstore.local'} / ${process.env.ADMIN_PASSWORD || 'Admin1234!'}`);
});
