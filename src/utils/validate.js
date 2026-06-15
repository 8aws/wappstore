'use strict';

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

module.exports = { isHttpUrl };
