/* ── i18n ── bilingual ES / EN ─────────────────────────────────────────── */
window.I18N = (() => {
  const T = {
    es: {
      // Nav
      'nav.store':'Tienda','nav.login':'Iniciar sesión','nav.register':'Registrarse',
      'nav.dashboard':'Mi panel','nav.admin':'Administración','nav.logout':'Cerrar sesión',
      // Catalog
      'catalog.title':'Descubre las mejores WebApps',
      'catalog.subtitle':'La tienda de aplicaciones web progresivas — gratuita y abierta',
      'catalog.search':'Buscar aplicaciones…','catalog.all':'Todas las categorías',
      'catalog.featured':'Destacadas','catalog.recent':'Recientes',
      'catalog.view':'Ver más','catalog.empty':'No hay aplicaciones que mostrar',
      'catalog.apps':'apps','catalog.developers':'desarrolladores',
      // App detail
      'app.visit':'Visitar app','app.download_icons':'Descargar iconos',
      'app.screenshots':'Capturas de pantalla','app.description':'Descripción',
      'app.details':'Detalles técnicos','app.version':'Versión',
      'app.platform':'Plataforma','app.tags':'Etiquetas','app.languages':'Idiomas',
      'app.pwa':'Instalable como PWA','app.offline':'Soporte sin conexión',
      'app.contact':'Contacto','app.privacy':'Política de privacidad',
      'app.terms':'Términos de uso','app.source':'Código fuente',
      'app.developer':'Desarrollador','app.category':'Categoría',
      'app.yes':'Sí','app.no':'No',
      // Auth
      'auth.login':'Iniciar sesión','auth.register':'Crear cuenta',
      'auth.email':'Correo electrónico','auth.password':'Contraseña',
      'auth.name':'Nombre completo','auth.submit_login':'Entrar',
      'auth.submit_register':'Crear cuenta','auth.no_account':'¿No tienes cuenta?',
      'auth.have_account':'¿Ya tienes cuenta?','auth.role':'Tipo de cuenta',
      'auth.client':'Cliente','auth.client_desc':'Descubre y usa WebApps',
      'auth.developer':'Desarrollador','auth.developer_desc':'Publica tu WebApp',
      // Dashboard
      'dash.my_apps':'Mis aplicaciones','dash.new_app':'Nueva app',
      'dash.edit':'Editar','dash.delete':'Eliminar','dash.preview':'Vista previa',
      'dash.status':'Estado','dash.actions':'Acciones',
      'dash.no_apps':'Aún no tienes ninguna app publicada',
      'dash.submit_new':'Envía tu primera app',
      'status.pending':'Pendiente','status.approved':'Aprobada','status.rejected':'Rechazada',
      // Form
      'form.name':'Nombre de la app','form.short_es':'Descripción corta (ES)',
      'form.short_en':'Descripción corta (EN)','form.desc_es':'Descripción completa (ES)',
      'form.desc_en':'Descripción completa (EN)','form.url':'URL de la webapp',
      'form.contact':'Email de contacto','form.category':'Categoría',
      'form.version':'Versión','form.platform':'Plataforma',
      'form.tags':'Etiquetas (separadas por coma)','form.languages':'Idiomas soportados',
      'form.pwa':'Es instalable como PWA','form.offline':'Funciona sin conexión',
      'form.privacy':'URL política de privacidad','form.terms':'URL términos de uso',
      'form.source':'URL código fuente','form.logo':'Logo de la app',
      'form.screenshots':'Capturas de pantalla (máx. 10)',
      'form.save':'Guardar','form.cancel':'Cancelar','form.submit':'Enviar para revisión',
      'form.size':'Tamaño (KB)',
      // Admin
      'admin.pending':'Pendientes','admin.all_apps':'Todas las apps',
      'admin.categories':'Categorías','admin.users':'Usuarios',
      'admin.approve':'Aprobar','admin.reject':'Rechazar','admin.featured':'Destacar',
      'admin.new_cat':'Nueva categoría','admin.cat_name_es':'Nombre (ES)',
      'admin.cat_name_en':'Nombre (EN)','admin.cat_icon':'Icono (emoji)',
      'admin.cat_color':'Color','admin.role':'Rol','admin.active':'Activo',
      // Messages
      'msg.loading':'Cargando…','msg.error':'Error inesperado','msg.saved':'Guardado correctamente',
      'msg.deleted':'Eliminado','msg.confirm_delete':'¿Eliminar? Esta acción es irreversible.',
      'msg.app_submitted':'App enviada. Quedará visible tras ser aprobada.',
      'msg.app_updated':'App actualizada. Pendiente de revisión.',
      'msg.login_required':'Debes iniciar sesión para continuar',
      'msg.no_permission':'No tienes permisos para esta acción',
      'msg.approved':'App aprobada ✓','msg.rejected':'App rechazada',
      // Launcher
      'launcher.title':'Mi Launcher',
      'launcher.subtitle':'Arrastra para reordenar o mover a carpetas. Instálalo como app desde el navegador.',
      'launcher.new_folder':'Nueva carpeta','launcher.install':'Instalar','launcher.add_apps':'Añadir apps',
      'launcher.no_folder':'Sin carpeta','launcher.drop_here':'Arrastra apps aquí…',
      'launcher.empty_title':'Tu launcher está vacío',
      'launcher.empty_hint':'Explora la tienda y pulsa “➕ Añadir a mi launcher” en cualquier app.',
      'launcher.login_title':'Inicia sesión para usar tu launcher',
      'launcher.explore':'Explorar la tienda','launcher.removed':'Quitada',
      // Profile
      'profile.title':'Mi perfil','profile.account':'Datos de la cuenta',
      'profile.name':'Nombre','profile.email':'Email','profile.role':'Rol',
      'profile.save':'Guardar cambios','profile.change_pw':'Cambiar contraseña',
      'profile.cur_pw':'Contraseña actual','profile.new_pw':'Nueva contraseña (mín. 6)',
      'profile.repeat_pw':'Repetir nueva contraseña','profile.update_pw':'Actualizar contraseña',
      // Admin extra
      'admin.maintenance':'Mantenimiento','admin.backup':'Copia de seguridad',
      'admin.backup_download':'Descargar backup','admin.restore':'Restaurar','admin.restore_now':'Restaurar ahora',
    },
    en: {
      'nav.store':'Store','nav.login':'Log in','nav.register':'Sign up',
      'nav.dashboard':'Dashboard','nav.admin':'Admin','nav.logout':'Log out',
      'catalog.title':'Discover the best WebApps',
      'catalog.subtitle':'The progressive web app store — free and open',
      'catalog.search':'Search applications…','catalog.all':'All categories',
      'catalog.featured':'Featured','catalog.recent':'Recent',
      'catalog.view':'View more','catalog.empty':'No apps to show',
      'catalog.apps':'apps','catalog.developers':'developers',
      'app.visit':'Visit app','app.download_icons':'Download icons',
      'app.screenshots':'Screenshots','app.description':'Description',
      'app.details':'Technical details','app.version':'Version',
      'app.platform':'Platform','app.tags':'Tags','app.languages':'Languages',
      'app.pwa':'PWA installable','app.offline':'Offline support',
      'app.contact':'Contact','app.privacy':'Privacy policy',
      'app.terms':'Terms of service','app.source':'Source code',
      'app.developer':'Developer','app.category':'Category',
      'app.yes':'Yes','app.no':'No',
      'auth.login':'Log in','auth.register':'Sign up',
      'auth.email':'Email address','auth.password':'Password',
      'auth.name':'Full name','auth.submit_login':'Sign in',
      'auth.submit_register':'Create account','auth.no_account':"Don't have an account?",
      'auth.have_account':'Already have an account?','auth.role':'Account type',
      'auth.client':'Client','auth.client_desc':'Discover and use WebApps',
      'auth.developer':'Developer','auth.developer_desc':'Publish your WebApp',
      'dash.my_apps':'My applications','dash.new_app':'New app',
      'dash.edit':'Edit','dash.delete':'Delete','dash.preview':'Preview',
      'dash.status':'Status','dash.actions':'Actions',
      'dash.no_apps':'You have no apps published yet',
      'dash.submit_new':'Submit your first app',
      'status.pending':'Pending','status.approved':'Approved','status.rejected':'Rejected',
      'form.name':'App name','form.short_es':'Short description (ES)',
      'form.short_en':'Short description (EN)','form.desc_es':'Full description (ES)',
      'form.desc_en':'Full description (EN)','form.url':'WebApp URL',
      'form.contact':'Contact email','form.category':'Category',
      'form.version':'Version','form.platform':'Platform',
      'form.tags':'Tags (comma-separated)','form.languages':'Supported languages',
      'form.pwa':'PWA installable','form.offline':'Works offline',
      'form.privacy':'Privacy policy URL','form.terms':'Terms of service URL',
      'form.source':'Source code URL','form.logo':'App logo',
      'form.screenshots':'Screenshots (max 10)',
      'form.save':'Save','form.cancel':'Cancel','form.submit':'Submit for review',
      'form.size':'Size (KB)',
      'admin.pending':'Pending','admin.all_apps':'All apps',
      'admin.categories':'Categories','admin.users':'Users',
      'admin.approve':'Approve','admin.reject':'Reject','admin.featured':'Feature',
      'admin.new_cat':'New category','admin.cat_name_es':'Name (ES)',
      'admin.cat_name_en':'Name (EN)','admin.cat_icon':'Icon (emoji)',
      'admin.cat_color':'Color','admin.role':'Role','admin.active':'Active',
      'msg.loading':'Loading…','msg.error':'Unexpected error','msg.saved':'Saved successfully',
      'msg.deleted':'Deleted','msg.confirm_delete':'Delete? This cannot be undone.',
      'msg.app_submitted':'App submitted. It will be visible after approval.',
      'msg.app_updated':'App updated. Pending review.',
      'msg.login_required':'You must log in to continue',
      'msg.no_permission':'You do not have permission for this action',
      'msg.approved':'App approved ✓','msg.rejected':'App rejected',
      'launcher.title':'My Launcher',
      'launcher.subtitle':'Drag to reorder or move into folders. Install it as an app from your browser.',
      'launcher.new_folder':'New folder','launcher.install':'Install','launcher.add_apps':'Add apps',
      'launcher.no_folder':'No folder','launcher.drop_here':'Drag apps here…',
      'launcher.empty_title':'Your launcher is empty',
      'launcher.empty_hint':'Browse the store and tap “➕ Add to my launcher” on any app.',
      'launcher.login_title':'Log in to use your launcher',
      'launcher.explore':'Browse the store','launcher.removed':'Removed',
      'profile.title':'My profile','profile.account':'Account details',
      'profile.name':'Name','profile.email':'Email','profile.role':'Role',
      'profile.save':'Save changes','profile.change_pw':'Change password',
      'profile.cur_pw':'Current password','profile.new_pw':'New password (min. 6)',
      'profile.repeat_pw':'Repeat new password','profile.update_pw':'Update password',
      'admin.maintenance':'Maintenance','admin.backup':'Backup',
      'admin.backup_download':'Download backup','admin.restore':'Restore','admin.restore_now':'Restore now',
    },
  };

  let lang = localStorage.getItem('wappstore_lang') || navigator.language.split('-')[0] || 'es';
  if (!T[lang]) lang = 'es';

  return {
    get lang() { return lang; },
    t(key) { return (T[lang]||T.es)[key] || T.es[key] || key; },
    setLang(l) {
      if (!T[l]) return;
      lang = l;
      localStorage.setItem('wappstore_lang', l);
      document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = this.t(el.dataset.i18n);
      });
      document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = this.t(el.dataset.i18nPlaceholder);
      });
      document.querySelectorAll('.lang-toggle button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === l);
      });
      document.dispatchEvent(new CustomEvent('langchange', { detail: l }));
    },
    applyAll() {
      document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = this.t(el.dataset.i18n);
      });
      document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = this.t(el.dataset.i18nPlaceholder);
      });
    },
    renderToggle(container) {
      const div = document.createElement('div');
      div.className = 'lang-toggle';
      ['es','en'].forEach(l => {
        const btn = document.createElement('button');
        btn.textContent = l.toUpperCase();
        btn.dataset.lang = l;
        if (l === lang) btn.classList.add('active');
        btn.addEventListener('click', () => this.setLang(l));
        div.appendChild(btn);
      });
      container.appendChild(div);
    },
  };
})();
