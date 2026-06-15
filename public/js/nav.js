/* ── Shared navigation renderer ─────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const nav = document.getElementById('main-nav');
  if (!nav) return;

  const user    = Auth.getUser();
  const isAdmin = user?.role === 'admin';
  const isDev   = user?.role === 'developer' || isAdmin;
  const t       = k => I18N.t(k);

  nav.innerHTML = `
    <a href="/" class="nav-logo">
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="8" fill="currentColor" opacity=".15"/>
        <path d="M8 10h16M8 16h10M8 22h13" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="24" cy="22" r="5" fill="currentColor" opacity=".9"/>
        <path d="M22.5 22l1.5 1.5L26 20.5" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      WAppStore
    </a>
    <div class="nav-actions">
      ${user ? `
        <span class="nav-user"><strong>${escHtml(user.name)}</strong></span>
        ${isDev   ? `<a href="/dashboard.html" class="btn btn-ghost btn-sm">${t('nav.dashboard')}</a>` : ''}
        ${isAdmin ? `<a href="/admin.html"     class="btn btn-ghost btn-sm">${t('nav.admin')}</a>` : ''}
        <button onclick="doLogout()" class="btn btn-ghost btn-sm">${t('nav.logout')}</button>
      ` : `
        <a href="/login.html"    class="btn btn-ghost   btn-sm">${t('nav.login')}</a>
        <a href="/register.html" class="btn btn-primary btn-sm">${t('nav.register')}</a>
      `}
      <div id="nav-lang"></div>
    </div>
  `;

  I18N.renderToggle(document.getElementById('nav-lang'));
  I18N.applyAll();
});

function doLogout() {
  Auth.clearSession();
  window.location.href = '/';
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
