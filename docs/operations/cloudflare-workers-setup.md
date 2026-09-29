# Cloudflare Workers — referencia de build

El repositorio conserva `@opennextjs/cloudflare` y `wrangler.toml` como
configuración de build compatible con el producto. No hay una ruta de
despliegue de producción hacia Cloudflare desde GitHub Actions ni desde este
runbook.

`app.qavante.com` se despliega a Azure Container Apps mediante
[Deploy web to Azure PROD](../../.github/workflows/deploy-azure-prod.yml),
siguiendo el [runbook](./deploy-runbook.md). No usa tokens de Cloudflare.

Para cambios de UI, validar el build correspondiente antes del merge y seguir
el runbook Azure al momento de una promoción autorizada. No usar paneles de
Cloudflare como bypass.
