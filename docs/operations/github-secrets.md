# GitHub Secrets — qavante-web

La ruta de producción es
[`Deploy web to Azure PROD`](../../.github/workflows/deploy-azure-prod.yml).
GitHub Actions es la ruta vigente para ejecutar este workflow.

El workflow requiere los secrets del repositorio `AZURE_TENANT_ID` y
`AZURE_SUBSCRIPTION_ID` y la credencial federada OIDC de Azure para la rama
que se vaya a desplegar (`main` o `integrate/main-azure-prod`). Verificar su
disponibilidad y permisos sin copiar sus valores a archivos, artefactos ni
salidas de comandos. El client ID del workflow no es un secreto.

Los secretos históricos de Cloudflare o QAS no son una ruta alternativa de
despliegue a PROD. La antigua [ruta local](./local-release.md) está inactiva
por defecto.
