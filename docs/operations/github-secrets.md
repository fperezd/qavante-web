# GitHub Secrets — qavante-web

GitHub Actions está deshabilitado y este repositorio no mantiene workflows de
despliegue, canary ni promoción. Por tanto, no se deben crear, rotar ni usar
secrets de GitHub para desplegar Qavante Web.

La promoción vigente es el [release local verificable](./local-release.md):
Docker y Azure CLI autenticados se ejecutan localmente, y el smoke limitado se
recibe sólo mediante `SMOKE_RUT` y `SMOKE_PASSWORD` como variables de entorno
locales. Esos valores no se escriben en GitHub, artefactos ni comandos
registrados.

Si existe algún secret histórico de Cloudflare, Azure o smoke en GitHub, no es
una vía autorizada de release. Gestionar su inventario y eventual revocación
por el proceso de seguridad correspondiente, sin reactivar workflows ni usar
el dashboard como bypass.
