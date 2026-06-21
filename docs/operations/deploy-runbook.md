# Runbook — Deploy a producción (app.qavante.com)

Deploy automático: push a `main` → `.github/workflows/deploy-cloudflare.yml` →
`wrangler deploy` al Worker `qavante-web`. Build OpenNext + deploy + smoke.

Salud continua: `prod-canary.yml` corre cada 6 h los smoke "FE alive" contra
prod y abre un issue (`prod-canary`) si fallan. Un deploy fallido abre un issue
(`deploy-failure`). **Si ves uno de esos issues, esto es lo que hay que hacer.**

## Síntoma: deploy falla con `Authentication error [code: 10000]`

Causa: el secret `CLOUDFLARE_API_TOKEN` expiró/se revocó. (Incidente real:
6→20 jun 2026, ~2 semanas sin llegar a prod con CI en verde.)

**Fix (requiere sesión de Cloudflare + GitHub del dueño; CC-WEB no toca secrets):**

1. **Generar token nuevo** en Cloudflare → https://dash.cloudflare.com/profile/api-tokens
   - "Create Token" → plantilla **"Editar Cloudflare Workers"** → _Usar plantilla_
   - Recursos de cuenta = tu cuenta → _Continuar con el resumen_ → _Crear token_ → copiar.
   - (Si el token viejo aún figura: menú «…» → **Roll** mantiene los permisos.)
2. **Actualizar el secret** en GitHub → repo Settings → Secrets and variables → Actions
   - `CLOUDFLARE_API_TOKEN` → Update → pegar token nuevo → Save.
   - Verificar que `CLOUDFLARE_ACCOUNT_ID` coincida con el Account ID del dashboard.
3. **Re-disparar el deploy:** `gh workflow run deploy-cloudflare.yml --ref main`
   (o "Re-run" del run fallido). En ~3-4 min queda live.

> Mitigación a futuro: crear el token **sin expiración** o calendarizar su
> rotación; el canary avisa, pero conviene que no caduque solo.

## Rollback del Worker (si un deploy publica algo roto)

```bash
wrangler deployments list          # ver versiones recientes
wrangler rollback                  # vuelve a la versión anterior
wrangler rollback <version-id>     # o a una específica
```

## Dominio nuevo → login 403

Servir el FE desde un origen nuevo (preview/www/staging/custom) da **login 403**
hasta sumarlo a `CSRF_ALLOWED_ORIGINS` del backend. Pedir el alta a CC-API
(issue en qavante-api con el origen exacto `https://host`). `app.qavante.com` ya
está permitido.

## Smoke gated de login en rojo (deploy OK pero smoke falla)

El smoke post-deploy incluye un test gated (`login flow`) que usa `SMOKE_RUT`/
`SMOKE_PASSWORD` y pega contra el backend (`/api/auth/login` → cookie → `/api/me`).
Si el deploy salió bien y los smoke "FE alive" pasan, un rojo acá es de
**backend/credenciales**, no del FE → escalar a CC-API (verificar creds + cookie chain).
