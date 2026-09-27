# Cloudflare Workers — referencia de build

El repositorio conserva `@opennextjs/cloudflare` y `wrangler.toml` como
configuración de build compatible con el producto. No hay una ruta de
despliegue de producción hacia Cloudflare desde GitHub Actions ni desde este
runbook.

`app.qavante.com` se promueve a Azure Container Apps exclusivamente mediante
el [release local verificable](./local-release.md). Esa ruta usa Docker local,
Azure CLI autenticado y una referencia OCI por digest; no usa tokens de
proveedor ni automatización de GitHub.

Para cambios de UI, validar el build correspondiente localmente y seguir el
runbook local al momento de una promoción autorizada. No usar paneles de
proveedor como bypass ni crear secretos de despliegue en GitHub.
