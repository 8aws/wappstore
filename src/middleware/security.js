'use strict';

// ── Cabeceras de seguridad (sin dependencias externas) ─────────────────────
// CSP estricta: todo es self-hosted, así que solo permitimos 'self'.
// 'unsafe-inline' es necesario porque las páginas usan <script> y estilos inline.
const CSP = [
  "default-src 'self'",
  "img-src 'self' data:",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ');

function securityHeaders(req, res, next) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.removeHeader('X-Powered-By');
  next();
}

// ── Rate limiter en memoria (suficiente para una instancia única) ──────────
function rateLimit({ windowMs = 15 * 60 * 1000, max = 10, message = 'Too many requests' } = {}) {
  const hits = new Map(); // ip -> [timestamps]
  return (req, res, next) => {
    const ip  = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const arr = (hits.get(ip) || []).filter(t => now - t < windowMs);
    arr.push(now);
    hits.set(ip, arr);
    if (arr.length > max) {
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      return res.status(429).json({ error: message });
    }
    next();
  };
}

module.exports = { securityHeaders, rateLimit };
