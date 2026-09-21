# Runbook — Deploy a producción (app.qavante.com)

El deploy automático por `push` está suspendido. Producción sólo se promueve con
`Release to Cloudflare Workers`, ejecutado manualmente **desde `main`** e indicando
el SHA completo del tip actual. El workflow valida de forma fail-closed que:

- el SHA pertenece a un PR ya mergeado a `main` y su árbol coincide con el árbol
  revisado;
- `ci-required` terminó `success` para ese SHA y, por tanto, todos los
  checks aplicables por paths terminaron bien; CodeQL conserva sus checks;
- `change-evidence` terminó `success` sobre el head exacto del PR;
- `production` admite exclusivamente ramas protegidas;
- `main` exige checks estrictos y actualizados, incluidos `ci-required`,
  `change-evidence` y los checks CodeQL, y los
  aplica también a administradores como configuración operacional externa;
- para `risk:R2`, existe un sign-off explícito del BO confiable sobre el SHA
  exacto. R0/R1 no añaden una aprobación ceremonial.

El gate completo se vuelve a evaluar dentro del job de promoción, después del
build. Justo antes de llamar a Wrangler se consulta otra vez el tip
de `main`; si avanzó durante el build o la espera, el release histórico se
cancela en vez de revertir cambios más nuevos.

Después construye una vez el bundle OpenNext, publica un artefacto inmutable con
SHA-256 y promueve exactamente ese `.tgz`, sin recompilar. El artefacto
`release-provenance-<sha>` conserva SHA/árbol/PR, digest, lista de deployments
previos (rollback), versión posterior, hash de la configuración efectiva y
observación de `/api/release`. La configuración de release parte del
`wrangler.toml` versionado y sólo sustituye los dos placeholders de procedencia;
no usa `--var`, que podría omitir las demás variables versionadas.

Verificar la procedencia en runtime es un sondeo con presupuesto, no una
lectura única: tras `wrangler deploy`, `.github/release/verify-runtime.mjs`
consulta `/api/release` cada 5 s durante hasta 120 s y da el paso por bueno en
cuanto `status == "ok"` y `source_sha`/`bundle_sha256` coinciden con el
release recién promovido. Un 5xx o un 200 con el bundle todavía anterior
(Cloudflare propagando) no fallan de inmediato: son una respuesta más que no
coincide y el sondeo reintenta hasta el siguiente intervalo. Sólo falla si se
agota el presupuesto completo sin una coincidencia, mostrando la última
respuesta vista (`runtime-release.json`, que también alimenta el artefacto de
procedencia). En la práctica esto significa que `gh run rerun <run_id>
--failed` ya no debería hacer falta por simple lag de propagación de
Cloudflare: el propio paso espera lo necesario dentro del mismo run. Si el
job igual falla, es porque `/api/release` no llegó a coincidir en 120 s
reales, y ahí sí corresponde investigar (o, si el deploy resultó correcto más
tarde, recién entonces re-ejecutar).

### Configuración obligatoria del gate compensatorio (una vez)

En `Settings → Environments → production`:

1. en **Deployment branches and tags**, elegir **Protected branches only** y
   mantener `main` protegida.
2. en la protección de `main`, exigir branches up to date (`strict`),
   `enforce_admins=true` y los checks
   requeridos `ci-required`, `change-evidence`,
   `Analyze (javascript-typescript)` y `Analyze (python)`, y aplicar la protección a
   administradores.
3. crear `PRODUCTION_CLOUDFLARE_API_TOKEN` y
   `PRODUCTION_CLOUDFLARE_ACCOUNT_ID` **sólo** como secrets del environment
   `production`. Migrar también `SMOKE_RUT`/`SMOKE_PASSWORD` a
   `PRODUCTION_SMOKE_RUT`/`PRODUCTION_SMOKE_PASSWORD` en el environment. Aún
   no borrar los secrets legacy de repositorio: el workflow vigente en `main`
   los requiere hasta que este PR se fusione.

El preflight verifica que `main` siga marcada como protegida, pero con las
credenciales actuales **no puede reconsultar en runtime** el detalle `strict`,
la lista de status checks ni `enforce_admins`. Por eso los controles de los
puntos 1 y 2 son requisitos operacionales externos y se deben verificar por un
admin antes de habilitar o reanudar releases. El workflow no afirma que los
verifica por sí solo; si falta esa evidencia, no se ejecuta el release. La
política externa de ramas protegidas es obligatoria: una rama puede cambiar el
YAML que carga `workflow_dispatch`, por lo que comprobar
`github.ref == refs/heads/main` dentro del propio archivo no basta.

### Sign-off BO y riesgo residual

Antes de mergear el PR que será release, `@fperezd` deja un comentario GitHub
fuera de un bloque de código sobre el head revisado exacto:

```text
bo_signoff: APPROVED
revisado: <SHA completo del head revisado>
```

El release gate exige ese comentario de la cuenta BO confiable sólo para
`risk:R2`; `change-evidence` cubre la evidencia mecánica de todo PR. La allowlist de BO vive en
[`.github/release-gate.mjs`](../../.github/release-gate.mjs) y está cubierta por
CODEOWNERS.

**Riesgo residual aceptado:** el plan GitHub Team de este repositorio privado no
ofrece native required reviewers ni la opción de desactivar el bypass de admins
para environments. Por ello no se afirma una aprobación nativa de environment.
Los controles compensatorios son la protección estricta y administrada de
`main` (verificada operacionalmente, no reconsultada por el workflow), la
evidencia mecánica, el sign-off BO R2 anclado al SHA y la revalidación de SHA/árbol/CI
antes y después de la espera del environment. Reducen el riesgo, pero no
sustituyen una regla nativa de environment; migrar a Enterprise Cloud sigue siendo
la mejora pendiente.

### Cierre de la migración de secrets (después del primer release gated)

Una vez fusionado este workflow, ejecutar y verificar un primer release gated
exitoso con los cuatro `PRODUCTION_*` (incluyendo procedencia runtime y smoke).
Sólo entonces eliminar del nivel repositorio `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`, `SMOKE_RUT` y `SMOKE_PASSWORD`, revocar el token
antiguo y rotar la contraseña de smoke. Mientras los legacy existan, una rama
podría intentar consumirlos quitando el environment de su propio YAML; por eso
el cierre es obligatorio, pero hacerlo antes del merge rompería el workflow
vigente.

Para promover, después de CI + evidencia y, si es R2, sign-off BO del PR:

```bash
git fetch origin main
sha=$(git rev-parse origin/main)
gh workflow run deploy-cloudflare.yml --ref main -f release_sha="$sha"
```

Salud continua: `prod-canary.yml` corre cada 6 h los smoke "FE alive" contra
prod y abre un issue (`prod-canary`) si fallan. Un deploy fallido abre un issue
(`deploy-failure`). **Si ves uno de esos issues, esto es lo que hay que hacer.**

## Síntoma: deploy falla con `Authentication error [code: 10000]`

Causa: el secret de environment `PRODUCTION_CLOUDFLARE_API_TOKEN` expiró/se
revocó. (Incidente real:
6→20 jun 2026, ~2 semanas sin llegar a prod con CI en verde.)

**Fix (requiere sesión de Cloudflare + GitHub del dueño; CC-WEB no toca secrets):**

1. **Generar token nuevo** en Cloudflare → https://dash.cloudflare.com/profile/api-tokens
   - "Create Token" → plantilla **"Editar Cloudflare Workers"** → _Usar plantilla_
   - Recursos de cuenta = tu cuenta → _Continuar con el resumen_ → _Crear token_ → copiar.
   - (Si el token viejo aún figura: menú «…» → **Roll** mantiene los permisos.)
2. **Actualizar el secret** en GitHub → Settings → Environments → production
   - `PRODUCTION_CLOUDFLARE_API_TOKEN` → Update → pegar token nuevo → Save.
   - Verificar que `PRODUCTION_CLOUDFLARE_ACCOUNT_ID` coincida con el Account ID.
3. **Re-disparar el release** indicando el SHA completo del tip actual de `main`
   como muestra el bloque anterior. No se acepta una rama ni un SHA histórico.

> Mitigación a futuro: crear el token **sin expiración** o calendarizar su
> rotación; el canary avisa, pero conviene que no caduque solo.

## Rollback del Worker (si un deploy publica algo roto)

```bash
wrangler deployments list          # ver versiones recientes
wrangler rollback                  # vuelve a la versión anterior
wrangler rollback <version-id>     # o a una específica
```

Antes de elegir la versión, descargar el artefacto
`release-provenance-<sha>` del run: `rollback-candidates.json` registra las
versiones que existían inmediatamente antes de la promoción. El rollback es una
acción de producción separada y requiere el gate humano correspondiente.

## Dominio nuevo → login 403

Servir el FE desde un origen nuevo (preview/www/staging/custom) da **login 403**
hasta sumarlo a `CSRF_ALLOWED_ORIGINS` del backend. Pedir el alta a CC-API
(issue en qavante-api con el origen exacto `https://host`). `app.qavante.com` ya
está permitido.

## Smoke gated de login en rojo (deploy OK pero smoke falla)

El smoke post-deploy incluye un test gated (`login flow`) que recibe
`SMOKE_RUT`/`SMOKE_PASSWORD` desde los secrets de environment
`PRODUCTION_SMOKE_RUT`/`PRODUCTION_SMOKE_PASSWORD` y pega contra el backend
(`/api/auth/login` → cookie → `/api/me`).
Si el deploy salió bien y los smoke "FE alive" pasan, un rojo acá es de
**backend/credenciales**, no del FE → escalar a CC-API (verificar creds + cookie chain).
