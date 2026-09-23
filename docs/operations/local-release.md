# Release local verificable de Qavante Web

`app.qavante.com` apunta a Azure Container Apps. Los workflows de Cloudflare y
Azure no ejecutan mientras GitHub Actions permanezca deshabilitado. Esta ruta
promueve desde `main` protegido hacia `ca-qavante-web-prod` en la suscripcion
Qavante, con Docker local y una imagen OCI fijada por digest.

## Precondiciones

- PR mergeado a `main` con arbol identico al head revisado, y estados
  `local-ci`, `local-change-evidence` y `local-security` requeridos y verdes.
- Checkout limpio en el tip exacto de `origin/main`; evidencia local de los
  gates disponible para que `local_release_preflight.py` la archive.
- `gh`, `git`, Docker, Python 3, Node y Azure CLI autenticados. La cuenta de
  Azure debe tener acceso a la suscripcion Qavante
  `bfb4d4b6-d4b4-4c13-aee8-aa1df5c58839`; no hace falta cambiar el default.
- `SMOKE_RUT` y `SMOKE_PASSWORD` en variables de entorno locales para una
  cuenta de produccion limitada. No se guardan en artefactos ni CLI.
- Container App en modo `Single`, con 100% del trafico en una sola revision.

## Preparar y promover

Desde `main`, tras `git fetch origin main`:

```powershell
$release = "C:\Temp\qavante-web-releases\$(git rev-parse --short=12 HEAD)"
node scripts/local_azure_release.mjs prepare $release
node scripts/local_azure_release.mjs promote $release
```

`prepare` vuelve a validar GitHub, proteccion de rama, SHA/arbol/PR y archivos
de evidencia. Archiva el arbol Git exacto, calcula su SHA-256, construye una
sola imagen Docker con `/api/release` enlazado a ese SHA y al digest de fuente,
y registra el ID inmutable local. Publica `local-release-candidate` sobre ese
SHA con el digest y la identidad autenticada. El digest reportado como
`bundle_sha256` en runtime corresponde al archivo fuente `source.tar`; el
digest OCI se registra aparte al publicar en ACR.

`promote` repite el preflight y verifica el artefacto y status candidato.
Captura la imagen anterior de Azure y resuelve su digest en ACR. Corre smoke
autenticado previo, sube la imagen ya construida a ACR y la resuelve por digest.
Actualiza el Container App solo con `repo@sha256`, verifica la imagen activa,
sondea `/api/release` y repite smoke autenticado. Solo entonces escribe
`production-receipt.json` con SHA, arbol, digest de fuente e imagen, PR, actor
y observacion. Cada intento conserva `azure-before.json`, imagen publicada y
observacion del runtime en `attempt-*`.

Ante fallo despues de comenzar la promocion, actualiza el Container App a la
imagen anterior por digest, verifica la imagen activa y repite smoke. Un recibo
de rollback no convierte el release fallido en exitoso. Si falla la lectura o
reversion de Azure, detener la operacion e inspeccionar produccion.

El directorio de release vive en `C:\Temp`, fuera de OneDrive. Archivarlo en
almacenamiento operativo antes de limpiarlo. La version Azure anterior puede
responder 503 en `/api/release`; el primer release se apoya en la imagen previa
capturada por digest y en smoke previo, sin inventar una identidad historica.
