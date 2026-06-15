/* ── API helper + auth store ────────────────────────────────────────────── */
window.Auth = (() => {
  const TOKEN_KEY = 'wappstore_token';
  const USER_KEY  = 'wappstore_user';
  return {
    getToken()  { return localStorage.getItem(TOKEN_KEY); },
    getUser()   { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } },
    setSession(token, user) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    },
    clearSession() {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },
    isLoggedIn() { return !!this.getToken(); },
    hasRole(...roles) { const u = this.getUser(); return u && roles.includes(u.role); },
  };
})();

window.API = (() => {
  async function req(method, path, body, isFormData = false) {
    const headers = {};
    const token   = Auth.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (body && !isFormData) headers['Content-Type'] = 'application/json';

    const resp = await fetch(path, {
      method,
      headers,
      body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
    });

    if (resp.status === 401) {
      Auth.clearSession();
      window.location.href = '/login.html';
      return;
    }

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
    return data;
  }

  return {
    // Public
    getApps:       (p = {}) => req('GET', '/api/public/apps?'       + new URLSearchParams(p)),
    getApp:        (slug, lang) => req('GET', `/api/public/apps/${slug}?lang=${lang}`),
    getCategories: (lang)   => req('GET', `/api/public/categories?lang=${lang}`),
    getStats:      ()       => req('GET', '/api/public/stats'),
    // Auth
    login:    (email, pw) => req('POST', '/api/auth/login',    { email, password: pw }),
    register: (d)         => req('POST', '/api/auth/register', d),
    me:       ()          => req('GET',  '/api/auth/me'),
    // Developer
    myApps:       ()    => req('GET',    '/api/developer/apps'),
    myApp:        (id)  => req('GET',    `/api/developer/apps/${id}`),
    createApp:    (d)   => req('POST',   '/api/developer/apps', d),
    updateApp:    (id,d)=> req('PUT',    `/api/developer/apps/${id}`, d),
    deleteApp:    (id)  => req('DELETE', `/api/developer/apps/${id}`),
    deleteScreenshot: (id) => req('DELETE', `/api/developer/screenshots/${id}`),
    // Admin
    adminStats:        ()        => req('GET',    '/api/admin/stats'),
    adminApps:         (p = {})  => req('GET',    '/api/admin/apps?' + new URLSearchParams(p)),
    adminSetStatus:    (id, st)  => req('PUT',    `/api/admin/apps/${id}/status`, { status: st }),
    adminSetFeatured:  (id, v)   => req('PUT',    `/api/admin/apps/${id}/featured`, { featured: v }),
    adminUpdateApp:    (id, d)   => req('PUT',    `/api/admin/apps/${id}`, d),
    adminDeleteApp:    (id)      => req('DELETE', `/api/admin/apps/${id}`),
    adminUsers:        ()        => req('GET',    '/api/admin/users'),
    adminUpdateUser:   (id, d)   => req('PUT',    `/api/admin/users/${id}`, d),
    adminDeleteUser:   (id)      => req('DELETE', `/api/admin/users/${id}`),
    adminCategories:   ()        => req('GET',    '/api/admin/categories'),
    adminCreateCat:    (d)       => req('POST',   '/api/admin/categories', d),
    adminUpdateCat:    (id, d)   => req('PUT',    `/api/admin/categories/${id}`, d),
    adminDeleteCat:    (id)      => req('DELETE', `/api/admin/categories/${id}`),
    adminDeleteSS:     (id)      => req('DELETE', `/api/admin/screenshots/${id}`),
    // Upload (FormData)
    uploadLogo:       (appId, fd) => req('POST', `/api/upload/logo/${appId}`,       fd, true),
    uploadScreenshots:(appId, fd) => req('POST', `/api/upload/screenshot/${appId}`, fd, true),
  };
})();

/* ── Toast notifications ────────────────────────────────────────────────── */
window.toast = (() => {
  let container;
  function getContainer() {
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }
  return {
    show(msg, type = 'info', ms = 3500) {
      const t = document.createElement('div');
      t.className = `toast toast-${type}`;
      t.textContent = msg;
      getContainer().appendChild(t);
      setTimeout(() => t.remove(), ms);
    },
    success: (m, ms) => window.toast.show(m, 'success', ms),
    error:   (m, ms) => window.toast.show(m, 'error', ms),
    info:    (m, ms) => window.toast.show(m, 'info', ms),
  };
})();
