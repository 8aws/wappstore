#!/usr/bin/env node
/**
 * Migra apps aprobadas de una instancia WAppStore a otra, vía API pública (origen)
 * + API de admin (destino). Descarga y re-sube logo y capturas, regenera iconos
 * y aprueba la app en el destino. Idempotente: omite las que ya existen.
 *
 * Uso:
 *   SRC=https://wappstore.uverse.es \
 *   DST=http://localhost:3000 \
 *   ADMIN_EMAIL=admin@... ADMIN_PASSWORD=... \
 *   node scripts/migrate-apps.mjs
 *
 * Requiere Node 18+ (fetch/FormData/Blob globales).
 */
'use strict';

const SRC = (process.env.SRC || '').replace(/\/$/, '');
const DST = (process.env.DST || '').replace(/\/$/, '');
const EMAIL = process.env.ADMIN_EMAIL;
const PASS  = process.env.ADMIN_PASSWORD;

if (!SRC || !DST || !EMAIL || !PASS) {
  console.error('Faltan variables: SRC, DST, ADMIN_EMAIL, ADMIN_PASSWORD');
  process.exit(1);
}

const log = (...a) => console.log(...a);

async function jget(url, token) {
  const r = await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
  if (!r.ok) throw new Error(`GET ${url} → ${r.status}`);
  return r.json();
}
async function jsend(method, url, token, body) {
  const r = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${method} ${url} → ${r.status} ${await r.text()}`);
  return r.json();
}
async function upload(url, token, field, files) {
  const fd = new FormData();
  for (const f of files) {
    const buf = await (await fetch(SRC + f.path)).arrayBuffer();
    fd.append(field, new Blob([buf], { type: f.type }), f.name);
  }
  const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
  if (!r.ok) throw new Error(`UPLOAD ${url} → ${r.status} ${await r.text()}`);
  return r.json();
}

(async () => {
  log(`→ Origen:  ${SRC}`);
  log(`→ Destino: ${DST}`);

  // Login destino
  const lr = await fetch(`${DST}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  if (!lr.ok) throw new Error(`Login destino falló (${lr.status}). ¿Credenciales admin correctas?`);
  const token = (await lr.json()).token;
  log('✓ Login admin en destino');

  // Mapa de categorías destino (slug → id) y apps ya existentes
  const dstCats = await jget(`${DST}/api/public/categories?lang=es`);
  const catBySlug = Object.fromEntries(dstCats.map(c => [c.slug, c.id]));
  const dstApps = (await jget(`${DST}/api/admin/apps?limit=500`, token)).apps;
  const existing = new Set(dstApps.map(a => a.slug));

  // Apps de origen
  const srcList = (await jget(`${SRC}/api/public/apps?limit=500`)).apps;
  log(`→ ${srcList.length} app(s) aprobada(s) en origen`);

  for (const summary of srcList) {
    const app = await jget(`${SRC}/api/public/apps/${summary.slug}?lang=es`);
    if (existing.has(app.slug)) { log(`• ${app.name}: ya existe en destino, omitida`); continue; }

    log(`• ${app.name}: creando…`);
    const created = await jsend('POST', `${DST}/api/developer/apps`, token, {
      name: app.name,
      short_desc_es: app.short_desc_es, short_desc_en: app.short_desc_en,
      description_es: app.description_es, description_en: app.description_en,
      url: app.url, contact_email: app.contact_email,
      category_id: app.category ? (catBySlug[app.category.slug] || null) : null,
      version: app.version, platform: app.platform,
      tags: app.tags || [], languages: app.languages || [],
      privacy_url: app.privacy_url || '', terms_url: app.terms_url || '', source_url: app.source_url || '',
      pwa_installable: !!app.pwa_installable, has_offline: !!app.has_offline,
    });
    const id = created.id;

    if (app.logo_url) {
      await upload(`${DST}/api/upload/logo/${id}`, token, 'logo',
        [{ path: app.logo_url, name: 'logo.png', type: 'image/png' }]);
      log('  ✓ logo + iconos');
    }
    if (app.screenshots?.length) {
      await upload(`${DST}/api/upload/screenshot/${id}`, token, 'screenshots',
        app.screenshots.map((s, i) => ({ path: s.url, name: `ss-${i}.jpg`, type: 'image/jpeg' })));
      log(`  ✓ ${app.screenshots.length} captura(s)`);
    }

    await jsend('PUT', `${DST}/api/admin/apps/${id}/status`, token, { status: 'approved' });
    if (app.featured) await jsend('PUT', `${DST}/api/admin/apps/${id}/featured`, token, { featured: true });
    log(`  ✓ ${app.name} aprobada`);
  }

  log('✔ Migración completada.');
})().catch(e => { console.error('✗', e.message); process.exit(1); });
