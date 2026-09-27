# Runbook — release a producción (app.qavante.com)

GitHub Actions está deshabilitado y no contiene workflows de despliegue, canary
ni promoción. Producción se promueve únicamente mediante el
[release local verificable hacia Azure Container Apps](./local-release.md).

Ese runbook exige `main` protegido, evidencia local SHA-bound, Docker, Azure CLI
autenticado, una imagen OCI inmutable y smoke autenticado. También describe la
verificación de procedencia y el rollback por digest. No usar GitHub Actions,
Wrangler, el dashboard ni secretos de GitHub como bypass de esa ruta.

Para una promoción, seguir los comandos y precondiciones de
[`local-release.md`](./local-release.md) desde un checkout limpio del tip de
`origin/main`.
