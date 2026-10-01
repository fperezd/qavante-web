# Runbook — despliegue web a Azure PROD

La ruta activa para `app.qavante.com` es
[`Deploy web to Azure PROD`](../../.github/workflows/deploy-azure-prod.yml).
GitHub Actions permanece habilitado como ruta vigente. Un `push` que cambie
`src/**`, `public/**`, `package.json`, `package-lock.json`, `Dockerfile`,
`next.config.ts` o el propio workflow dispara el deploy desde `main` **o desde
`integrate/main-azure-prod`**. Ambas ramas apuntan a la misma Container App de
PROD. También existe `workflow_dispatch`. No suponer que GitHub repetirá un
evento anterior.

Antes de ejecutarlo, confirmar el SHA y los checks de la rama que se va a
desplegar, los secrets `AZURE_TENANT_ID` y `AZURE_SUBSCRIPTION_ID`, y la
credencial federada OIDC para esa rama. El workflow construye la imagen con
`NEXT_PUBLIC_API_URL=https://api.qavante.com`, la sube a
`acrqavanteprod.azurecr.io/qavante-web`, actualiza `ca-qavante-web-prod` y
comprueba que `/login` responda. Mantener Actions habilitado tras verificar el
resultado de la ventana.

**Límite del workflow recuperado:** publica también el tag mutable `prod`,
actualiza por tag, y sólo comprueba `/login`; no ejecuta smoke autenticado,
verificación de procedencia por digest ni rollback automático. Verificar
manualmente el flujo crítico y conservar la revisión anterior de Azure para un
rollback operativo si el despliegue falla. No interpretar un `/login` correcto
como prueba de compatibilidad con la API o de migraciones de datos.

La antigua [ruta local](./local-release.md) queda inactiva por defecto; su CLI
exige una reactivación explícita y no debe usarse para este despliegue. No usar
Cloudflare ni QAS como rutas alternativas de producción.
