'use strict';
const express = require('express');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;
global.JWT_SECRET = process.env.JWT_SECRET || 'wappstore-dev-secret-change-in-prod';

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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Static ─────────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

// ── API Routes ─────────────────────────────────────────────────────────────
app.use('/api/public',    require('./src/routes/public'));
app.use('/api/auth',      require('./src/routes/auth'));
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
