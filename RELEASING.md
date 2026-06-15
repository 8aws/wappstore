# Releases & Docker — WAppStore

La publicación está automatizada con **GitHub Actions**. Hay dos workflows:

| Workflow | Cuándo corre | Qué hace |
|----------|--------------|----------|
| [`ci.yml`](.github/workflows/ci.yml) | push/PR a `main` | Instala deps y construye la imagen Docker (sin publicar) como verificación |
| [`release.yml`](.github/workflows/release.yml) | al empujar un tag `vX.Y.Z` | Construye la imagen, la publica en GHCR (+ Docker Hub si está configurado) y crea la GitHub Release con notas automáticas |

## Hacer una release

```bash
# 1. Asegúrate de tener main al día y commiteado
git tag v1.2.0          # debe ser semver: vMAYOR.MENOR.PARCHE
git push origin v1.2.0
```

Eso dispara `release.yml`, que publica estas etiquetas de imagen:

- `1.2.0`, `1.2`, `1`, `latest`

en:

- **GHCR** → `ghcr.io/8aws/wappstore` (siempre, usa el `GITHUB_TOKEN` integrado)
- **Docker Hub** → `docker.io/<usuario>/wappstore` (solo si configuras los secretos, ver abajo)

## Configurar Docker Hub (opcional)

Sin estos secretos, la release publica **solo en GHCR** y avisa con un warning (no falla).

1. Crea un Access Token en Docker Hub: <https://hub.docker.com/settings/security>
2. Añade los secretos al repo:

```bash
gh secret set DOCKERHUB_USERNAME --body "tu_usuario_dockerhub"
gh secret set DOCKERHUB_TOKEN    --body "dckr_pat_xxxxxxxx"
```

## Usar la imagen publicada

```bash
docker pull ghcr.io/8aws/wappstore:latest
# o una versión fija:
docker pull ghcr.io/8aws/wappstore:1.2.0
```

> El paquete GHCR de un repo público es público por defecto. Si la primera publicación
> aparece como privada, hazlo público en GitHub → Packages → wappstore → Package settings.

## Notas

- Las imágenes de release son **multi-arquitectura**: `linux/amd64` + `linux/arm64`
  (Apple Silicon, Raspberry Pi, servidores ARM). Docker elige la variante correcta al hacer `pull`.
- La versión de la imagen viene del **tag git**, no de `package.json`. Mantén ambos en
  sincronía si te importa la coherencia (`npm version <x>` actualiza `package.json` y crea el tag).
- ⚠️ Este repo es **público**: nunca pongas secretos reales en archivos versionados
  (`cosmos-deploy.yml`, `docker-compose.yml` y `.env.example` usan placeholders).
