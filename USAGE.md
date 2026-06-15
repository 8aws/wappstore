# WAppStore — Guía de uso

## Arrancar con Docker (recomendado)

```bash
# 1. Copiar variables de entorno
cp .env.example .env
# Editar .env: cambiar JWT_SECRET, ADMIN_PASSWORD, ADMIN_EMAIL

# 2. Construir y arrancar
docker compose up -d

# 3. Abrir en el navegador
open http://localhost:3000
```

## Instalar en ZimaOS / CasaOS (icono en el escritorio)

> ⚠️ Un `docker pull` por terminal **no** crea el icono en el escritorio de ZimaOS.
> ZimaOS solo muestra las apps que instala su propio gestor mediante un compose con
> metadatos `x-casaos`. Usa el archivo [`zimaos-compose.yml`](zimaos-compose.yml):

1. En ZimaOS abre **App Store**.
2. Pulsa el botón **`+`** (arriba a la derecha) → **Install a customized app**.
3. Pega el contenido de [`zimaos-compose.yml`](zimaos-compose.yml).
4. Cambia `JWT_SECRET`, `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
5. **Install** → aparece el icono en el escritorio y un botón "Open Web UI".

La imagen es multi-arquitectura (amd64 + arm64), así que funciona en cualquier ZimaOS.

## Arrancar en local (Node.js)

```bash
npm install
node server.js
# → http://localhost:3000
```

## Credenciales por defecto

| Usuario | Email                    | Contraseña  | Rol   |
|---------|--------------------------|-------------|-------|
| Admin   | admin@wappstore.local    | Admin1234!  | admin |

## URLs principales

| Página           | URL                  |
|------------------|----------------------|
| Catálogo público | `/`                  |
| Detalle de app   | `/app.html?slug=…`   |
| Login            | `/login.html`        |
| Registro         | `/register.html`     |
| Panel developer  | `/dashboard.html`    |
| Panel admin      | `/admin.html`        |

## Flujo de uso

1. **Registro** → un desarrollador se registra con rol "Desarrollador"
2. **Publica** → sube logo, capturas y datos de su app
3. **Admin revisa** → aprueba o rechaza desde `/admin.html`
4. **Catálogo** → la app aparece en la tienda pública

## Generación de iconos

Al subir el logo de una app se generan automáticamente:
- `favicon.ico` (16×16 + 32×32)
- `favicon-16x16.png`, `favicon-32x32.png`, `favicon-48x48.png`
- `apple-touch-icon.png` (180×180)
- `icon-72/96/128/144/152/192/256/384/512.png` (PWA)
- `manifest.json` (plantilla de manifiesto PWA)
- `README.md` con el snippet HTML

Todo empaquetado en un ZIP descargable desde la ficha de la app.

## Variables de entorno

| Variable        | Default                  | Descripción                    |
|-----------------|--------------------------|--------------------------------|
| PORT            | 3000                     | Puerto del servidor            |
| JWT_SECRET      | (cambiar en producción)  | Secreto para tokens JWT        |
| ADMIN_EMAIL     | admin@wappstore.local    | Email del admin inicial        |
| ADMIN_PASSWORD  | Admin1234!               | Contraseña del admin inicial   |
| DB_PATH         | ./data/wappstore.db      | Ruta de la base de datos       |
