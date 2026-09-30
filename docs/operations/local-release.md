# Release local verificable de Qavante Web (inactivo)

> **Procedimiento desactivado por defecto.** Se conserva como referencia
> histórica y no se usa para desplegar a producción. La CLI requiere activar
> explícitamente `QAVANTE_ENABLE_LEGACY_LOCAL_RELEASE=1`; la ruta prioritaria
> es [Deploy web to Azure PROD](../../.github/workflows/deploy-azure-prod.yml).
> GitHub Actions se habilita manualmente durante la ventana de despliegue.
> Con Actions habilitado, un push relevante a `main` o a
> `integrate/main-azure-prod` dispara el deploy; `workflow_dispatch` permite
> iniciarlo después si el push ocurrió mientras Actions estaba deshabilitado.
> El workflow recuperado no ofrece las verificaciones ni el rollback automático
> descritos abajo para el procedimiento local antiguo.

`app.qavante.com` apunta a Azure Container Apps. Los workflows de Cloudflare y
Azure no ejecutan mientras GitHub Actions permanezca deshabilitado. Los pasos
de abajo describen la ruta local anterior, ahora inactiva, que promovía desde
`main` protegido hacia `ca-qavante-web-prod` con Docker local y digest OCI.

## Precondiciones

- PR mergeado a `main` con arbol identico al head revisado, y estados
  `local-ci`, `local-change-evidence` y `local-security` requeridos y verdes.
- Checkout limpio en el tip exacto de `origin/main`; evidencia local de los
  gates disponible para que `local_release_preflight.py` la archive.
- `gh`, `git`, Docker, Python 3, Node, Azure CLI y Cosign autenticados. La cuenta de
  Azure debe tener acceso a la suscripcion Qavante
  `bfb4d4b6-d4b4-4c13-aee8-aa1df5c58839`; no hace falta cambiar el default.
- `SMOKE_RUT` y `SMOKE_PASSWORD` en variables de entorno locales para una
  cuenta de produccion limitada. No se guardan en artefactos ni CLI.
- `COSIGN_KEY`, `COSIGN_PUBLIC_KEY` y `COSIGN_PASSWORD`: el mismo material de
  firma que usa el release de la API (`qavante-api/docs/LOCAL_AZURE_RELEASE.md`).
  `promote` falla antes de leer Azure si falta cualquiera de las cinco variables
  y el error nombra sólo las ausentes, nunca valores.
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
y registra el ID inmutable local. Antes de publicar el status candidato lee
`docker image inspect` y exige que la imagen hornee `NEXT_PUBLIC_API_URL`
exactamente `https://api.qavante.com`, `NEXT_PUBLIC_APP_ENV=prod` y el SHA,
árbol, digest de fuente y versión del manifiesto (`assertBakedWebImage`); un
host `*.azurecontainerapps.io` u otro dominio falla cerrado. Publica `local-release-candidate` sobre ese
SHA con el digest y la identidad autenticada. El digest reportado como
`bundle_sha256` en runtime corresponde al archivo fuente `source.tar`; el
digest OCI se registra aparte al publicar en ACR. Al promover, la nueva
revisión de Azure recibe además el árbol Git, versión de `package.json` y la
referencia OCI por digest. `/api/release` responde 200 sólo si los cinco
valores son válidos; así una respuesta 200 certifica procedencia completa y no
expone secretos.

`promote` repite el preflight y verifica el artefacto y status candidato,
exige las credenciales de smoke y Cosign y repite `assertBakedWebImage` sobre
la imagen local. Captura la imagen anterior de Azure, valida su entorno en modo
lectura (`azureWebRuntimeReadiness`: ninguna variable apunta a un host
`*.azurecontainerapps.io` y, si la revisión declara `NEXT_PUBLIC_API_URL`, es
exactamente el dominio canónico) y resuelve su digest en ACR. Corre smoke
autenticado previo, sube la imagen ya construida a ACR y la resuelve por digest.
Firma ese digest con `cosign sign --key $COSIGN_KEY`, lo verifica con
`cosign verify --key $COSIGN_PUBLIC_KEY` y exige que la evidencia atestigüe
exactamente ese `sha256` (`verifySignatureForDigest`); sin firma verificada no
hay cambio en Azure. La evidencia queda en `signature-verification.json` y su
SHA-256 en el recibo de producción. Actualiza el Container App solo con `repo@sha256`, verifica la imagen activa,
sondea `/api/release` y repite smoke autenticado. Solo entonces escribe
`production-receipt.json` con SHA, arbol, digest de fuente e imagen, PR, actor
y observacion. Cada intento conserva `azure-before.json`, imagen publicada y
observacion del runtime en `attempt-*`.

Ante fallo despues de comenzar la promocion, actualiza el Container App a la
imagen anterior por digest, restaura exactamente las variables de procedencia
que tenía esa revisión (o elimina las que no existían), verifica esa identidad
en `/api/release` y repite smoke. Un recibo
de rollback no convierte el release fallido en exitoso. Si falla la lectura o
reversion de Azure, detener la operacion e inspeccionar produccion.

El directorio de release vive en `C:\Temp`, fuera de OneDrive. Archivarlo en
almacenamiento operativo antes de limpiarlo. La version Azure anterior puede
responder 503 en `/api/release`; el primer release se apoya en la imagen previa
capturada por digest y en smoke previo, sin inventar una identidad historica.
