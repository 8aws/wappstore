import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4555;
const B = `http://127.0.0.1:${PORT}`;
const DB = join(tmpdir(), `wapp-smoke-${Date.now()}.db`);
const ADMIN = { email: 'admin@smoke.test', password: 'Smoke1234!' };
let child, adminToken, appId;

const j = async (method, path, { token, body } = {}) => {
  const r = await fetch(B + path, {
    method,
    headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(body && { 'Content-Type': 'application/json' }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
};

before(async () => {
  child = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), DB_PATH: DB, JWT_SECRET: 'smoke-secret',
           ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD: ADMIN.password, BACKUP_INTERVAL_HOURS: '0' },
    stdio: 'ignore',
  });
  // Espera a que responda
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(`${B}/api/public/stats`); if (r.ok) return; } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('El servidor no arrancó a tiempo');
});

after(() => {
  child?.kill('SIGKILL');
  for (const ext of ['', '-wal', '-shm']) { try { rmSync(DB + ext); } catch {} }
});

test('stats público responde 200', async () => {
  const { status, data } = await j('GET', '/api/public/stats');
  assert.equal(status, 200);
  assert.equal(typeof data.total_apps, 'number');
});

test('endpoint protegido sin token → 401', async () => {
  const { status } = await j('GET', '/api/me/library');
  assert.equal(status, 401);
});

test('login admin devuelve token', async () => {
  const { status, data } = await j('POST', '/api/auth/login', { body: ADMIN });
  assert.equal(status, 200);
  assert.ok(data.token);
  adminToken = data.token;
});

test('rechaza URL no http(s) al crear app', async () => {
  const { status } = await j('POST', '/api/developer/apps', { token: adminToken, body: { name: 'X', url: 'javascript:alert(1)' } });
  assert.equal(status, 400);
});

test('crea y aprueba una app', async () => {
  const c = await j('POST', '/api/developer/apps', { token: adminToken, body: { name: 'Smoke App', url: 'https://example.com', short_desc_es: 'cartera fidelidad' } });
  assert.equal(c.status, 201);
  appId = c.data.id;
  const a = await j('PUT', `/api/admin/apps/${appId}/status`, { token: adminToken, body: { status: 'approved' } });
  assert.equal(a.status, 200);
  const pub = await j('GET', '/api/public/apps/smoke-app');
  assert.equal(pub.status, 200);
  assert.equal(pub.data.name, 'Smoke App');
});

test('búsqueda FTS encuentra la app', async () => {
  const { status, data } = await j('GET', '/api/public/apps?search=fidelidad');
  assert.equal(status, 200);
  assert.ok(data.apps.some(a => a.id === appId), 'la búsqueda debería devolver la app');
});

test('biblioteca: añadir y listar', async () => {
  const add = await j('POST', '/api/me/library', { token: adminToken, body: { app_id: appId } });
  assert.equal(add.status, 201);
  const lib = await j('GET', '/api/me/library', { token: adminToken });
  assert.ok(lib.data.some(a => a.id === appId));
});

test('reseña: crear y reflejar media', async () => {
  const r = await j('POST', '/api/me/reviews', { token: adminToken, body: { app_id: appId, rating: 5, comment: 'genial' } });
  assert.equal(r.status, 201);
  const pub = await j('GET', '/api/public/apps/smoke-app');
  assert.equal(pub.data.rating_count, 1);
  assert.equal(pub.data.rating_avg, 5);
});

test('backup admin devuelve un fichero .db', async () => {
  const r = await fetch(`${B}/api/admin/backup`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(r.status, 200);
  const buf = Buffer.from(await r.arrayBuffer());
  assert.ok(buf.length > 1000, 'el backup debería tener contenido');
  assert.equal(buf.subarray(0, 15).toString(), 'SQLite format 3');
});
