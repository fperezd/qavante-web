# GitHub Secrets — qavante-web

Inventario de secrets que el CI/CD necesita y cómo crearlos. Una sola fuente para evitar el "el deploy falla porque falta un secret" del bootstrap.

> **Última actualización:** 2026-09-07.
> **Actualizar:** cuando se agregue, rote, o quite un secret. Mismo PR del cambio.

## Inventario

### Repo secrets (`Settings → Secrets and variables → Actions → Repository secrets`)

Las credenciales de producción no deben permanecer aquí de forma permanente.
Durante esta migración, conservar temporalmente `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`, `SMOKE_RUT` y `SMOKE_PASSWORD`: el workflow vigente
en `main` aún los consume hasta que este PR se fusione. Después de fusionar el
workflow gated y verificar un primer release exitoso con los secretos
`PRODUCTION_*`, eliminar esas cuatro copias del repositorio, revocar el token
antiguo y rotar la contraseña de smoke. No revocarlos antes: rompería el deploy
vigente sin habilitar todavía el reemplazo protegido.

### Environment secrets (`Settings → Environments → production → Environment secrets`)

| Nombre                             | Cuándo agregar                          | Propósito                                                                                                                                     |
| ---------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `PRODUCTION_CLOUDFLARE_API_TOKEN`  | Antes del primer release gated          | Token de mínimo privilegio consumible sólo después de aprobar `production`.                                                                   |
| `PRODUCTION_CLOUDFLARE_ACCOUNT_ID` | Antes del primer release gated          | Cuenta donde vive el Worker; se scopea junto al token para que el workflow no caiga a credenciales de repo.                                   |
| `PRODUCTION_SMOKE_RUT`             | Cuando exista usuario de prueba en prod | Habilita el test gated en [prod-health.smoke.spec.ts](../../tests/e2e/prod-health.smoke.spec.ts) que valida login flow + cookie cross-origin. |
| `PRODUCTION_SMOKE_PASSWORD`        | Idem                                    | Pareja del anterior; rotar al migrar desde repo-level.                                                                                        |

### NO usar estos como secrets (son configuración pública)

| Variable              | Dónde vive                                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | [wrangler.toml](../../wrangler.toml) — versionado en git. Es la URL del backend, visible al cliente, NO sensible. |
| `NEXT_PUBLIC_APP_ENV` | Idem.                                                                                                             |

## Cómo crear el `CLOUDFLARE_API_TOKEN`

1. Login en Cloudflare → click avatar arriba derecha → **My Profile → API Tokens**.
2. **Create Token**.
3. **Use template: "Edit Cloudflare Workers"** (no usar el global "Global API Key" — viola principio de menor privilegio).
4. Ajustar permisos del template para que incluya **solo**:
   - Account → Workers Scripts → **Edit**
   - Account → Workers KV Storage → **Edit** (solo si se usa KV — qavante-web actualmente no lo usa).
   - Account → Workers Routes → **Edit** (necesario para custom domains declarativos).
   - Zone → Workers Routes → **Edit** (acotar a la zona `qavante.com`).
   - User → User Details → **Read** (lo pide wrangler para identificarse).
5. **Account Resources:** restringir a la cuenta que tiene el Worker (la del usuario actual de Cloudflare).
6. **Zone Resources:** restringir a `qavante.com` (no all-zones).
7. **TTL del token:** dejar "No expiration" para CI estable, o setear 90 días + agregar al calendario para rotación.
8. **Create Token** → copiar el token (solo se ve una vez).

### Agregar el token a GitHub

1. Repo `tooxs-digital/qavante-web` → **Settings → Environments → production**.
2. **Environment secrets** → **Add secret**.
3. Name: `PRODUCTION_CLOUDFLARE_API_TOKEN` (case-sensitive, exactamente así).
4. Secret: pegar el token.
5. **Add secret**.

## Cómo encontrar el `CLOUDFLARE_ACCOUNT_ID`

1. Cloudflare dashboard → cualquier dominio o Workers section.
2. Sidebar derecha → bajo **API**, copiar **Account ID** (string hex de 32 chars, e.g., `8783bdbfcb6a64d278250b1e94bbc8c8`).
3. Agregarlo al mismo environment como `PRODUCTION_CLOUDFLARE_ACCOUNT_ID`
   (mismo procedimiento que el token; es identificador, pero mantener el scope
   impide fallback accidental a nombres repo-level).

## Cómo rotar un secret

1. Crear nuevo secret en la fuente (Cloudflare → nuevo API token, o BE → cambiar password del user de smoke, etc.).
2. **No** borrar el viejo todavía.
3. En GitHub → editar el secret del environment `production` con el nuevo valor.
4. Si corresponde al Worker, seguir el release manual por SHA exacto de
   [`deploy-runbook.md`](./deploy-runbook.md). No ejecutar el workflow desde una
   rama ni omitir su sign-off BO.
5. Tras fusionar el workflow gated y verificar un primer release exitoso con
   los nuevos secrets del environment, eliminar la copia legacy de repositorio
   y recién entonces revocar/rotar el secreto viejo en la fuente.

## Validación

Para verificar qué secrets están definidos sin exponerlos:

```bash
gh secret list                          # tras el primer release gated verificado, debe omitir los legacy de producción
gh secret list --env production         # debe listar PRODUCTION_CLOUDFLARE_*
```

Si el workflow falla indicando que falta `CLOUDFLARE_API_TOKEN`, comprobar que
`PRODUCTION_CLOUDFLARE_API_TOKEN` existe en el environment (no en repo), que el
job atravesó la aprobación y que el token no expiró/revocó.

## Referencias

- [.github/workflows/deploy-cloudflare.yml](../../.github/workflows/deploy-cloudflare.yml) — donde se consumen.
- [Cloudflare API tokens docs](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/).
- [GitHub Actions secrets docs](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions).
- [ADR-0001](../adr/0001-cloudflare-workers-vs-pages.md) — por qué Cloudflare Workers.
