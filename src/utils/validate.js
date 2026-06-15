'use strict';
const dns = require('dns').promises;
const net = require('net');

// Solo http/https — evita esquemas peligrosos como javascript: o data: en enlaces.
function isHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// ¿IP en rango privado/loopback/link-local? (anti-SSRF)
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;          // link-local
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
    if (a === 192 && b === 168) return true;          // 192.168/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  const v = ip.toLowerCase();
  return v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:127') || v === '::';
}

// Valida que la URL sea http(s) pública (resuelve DNS y rechaza IPs privadas).
// Lanza Error si no es segura; devuelve la URL normalizada si lo es.
async function assertPublicUrl(value) {
  if (!isHttpUrl(value)) throw new Error('URL inválida (solo http/https)');
  const u = new URL(value.trim());
  const host = u.hostname.replace(/^\[|\]$/g, '');
  let ips;
  if (net.isIP(host)) ips = [host];
  else {
    const recs = await dns.lookup(host, { all: true });
    ips = recs.map(r => r.address);
  }
  if (!ips.length || ips.some(isPrivateIp)) throw new Error('Destino no permitido (red privada)');
  return u.toString();
}

module.exports = { isHttpUrl, isPrivateIp, assertPublicUrl };
