# GitHub Secrets — qavante-web

Inventario de secrets que el CI/CD necesita y cómo crearlos. Una sola fuente para evitar el "el deploy falla porque falta un secret" del bootstrap.

> **Última actualización:** 2026-05-12.
> **Actualizar:** cuando se agregue, rote, o quite un secret. Mismo PR del cambio.

## Inventario

### Repo secrets (`Settings → Secrets and variables → Actions → Repository secrets`)

| Nombre                  | Consumido por                                                          | Propósito                                                             | Cuándo rotar                                                       |
| ----------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `CLOUDFLARE_API_TOKEN`  | [deploy-cloudflare.yml](../../.github/workflows/deploy-cloudflare.yml) | `wrangler deploy` lo usa para autenticar contra el API de Cloudflare. | Cada 90 días o si hay sospecha de leak.                            |
| `CLOUDFLARE_ACCOUNT_ID` | [deploy-cloudflare.yml](../../.github/workflows/deploy-cloudflare.yml) | Identifica la cuenta donde vive el Worker `qavante-web`.              | Solo si se mueve a otra cuenta Cloudflare (cambio organizacional). |

### Environment secrets (`Settings → Environments → production → Environment secrets`)

Por ahora vacío. Pendientes de agregar cuando exista el flow correspondiente:

| Nombre           | Cuándo agregar                                                                                            | Propósito                                                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `SMOKE_RUT`      | Cuando exista usuario de prueba en backend prod                                                           | Habilita el test gated en [prod-health.smoke.spec.ts](../../tests/e2e/prod-health.smoke.spec.ts) que valida login flow + cookie cross-origin. |
| `SMOKE_PASSWORD` | Idem                                                                                                      | Pareja del anterior.                                                                                                                          |
| `SMOKE_API_URL`  | Solo si se quiere apuntar el smoke a un BE distinto del default `https://api.qavante.com` (e.g., staging) | Override del default.                                                                                                                         |

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

1. Repo `fperezd/qavante-web` → **Settings → Secrets and variables → Actions**.
2. Pestaña **Repository secrets** → **New repository secret**.
3. Name: `CLOUDFLARE_API_TOKEN` (case-sensitive, exactamente así).
4. Secret: pegar el token.
5. **Add secret**.

## Cómo encontrar el `CLOUDFLARE_ACCOUNT_ID`

1. Cloudflare dashboard → cualquier dominio o Workers section.
2. Sidebar derecha → bajo **API**, copiar **Account ID** (string hex de 32 chars, e.g., `8783bdbfcb6a64d278250b1e94bbc8c8`).
3. Agregarlo a GitHub como `CLOUDFLARE_ACCOUNT_ID` (mismo procedimiento que el token, sin sensibilidad — es identificador, no credencial).

## Cómo rotar un secret

1. Crear nuevo secret en la fuente (Cloudflare → nuevo API token, o BE → cambiar password del user de smoke, etc.).
2. **No** borrar el viejo todavía.
3. En GitHub → editar el secret existente con el nuevo valor.
4. Re-disparar el workflow afectado (`gh workflow run deploy-cloudflare.yml`) y verificar que pasa.
5. Recién entonces revocar el secret viejo en la fuente.

## Validación

Para verificar qué secrets están definidos sin exponerlos:

```bash
gh secret list                          # repo-level
gh secret list --env production         # environment-level
```

Si el workflow `deploy-cloudflare.yml` empieza a fallar con `"In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN environment variable"`, es porque el secret se borró, expiró, o el workflow lo está leyendo con nombre incorrecto.

## Referencias

- [.github/workflows/deploy-cloudflare.yml](../../.github/workflows/deploy-cloudflare.yml) — donde se consumen.
- [Cloudflare API tokens docs](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/).
- [GitHub Actions secrets docs](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions).
- [ADR-0001](../adr/0001-cloudflare-workers-vs-pages.md) — por qué Cloudflare Workers.
