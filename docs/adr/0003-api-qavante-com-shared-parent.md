# ADR-0003: Backend en `api.qavante.com` para shared parent con FE

- **Status:** Accepted
- **Fecha:** 2026-05-12
- **Decididores:** Fernando
- **Tickets / PRs:** qavante-web #25 · qavante-api #58

## Contexto

Tras ADR-0002 el frontend vive en `app.qavante.com` (Cloudflare Worker). El backend FastAPI sigue en `tooxs-gestion-api.fly.dev` — **distinto parent domain** que el FE.

El contrato de cookie de sesión en [docs/backend-contracts/c0-auth-and-users.md](../backend-contracts/c0-auth-and-users.md) declara `SameSite=Lax`. Eso fue válido cuando el plan era todo bajo `qavante.cl`. Con la realidad post-ADR-0002, **Lax no funciona cross-origin con `credentials: 'include'`**: el browser solo envía la cookie en navegaciones top-level, no en `fetch` AJAX. Resultado: el login en prod estaría roto.

Dos caminos para destrabar:

1. **Mover el backend a `api.qavante.com`** (subdominio shared con FE bajo `.qavante.com`). Cookie con `Domain=.qavante.com` viaja en ambos. `SameSite=Lax` sigue siendo correcto.
2. **Aceptar `SameSite=None + Secure`** como default prod. Funciona pero pierde la defensa pasiva de Lax contra CSRF.

## Decisión

**Opción 1: el backend pasa a servir en `api.qavante.com`** vía CNAME a `tooxs-gestion-api.fly.dev`. La Fly app no se renombra (rename diferido a Fase 2 según Kit C0 sec 1.1) — solo se agrega un custom hostname.

Configuración resultante:

- **DNS:** `api.qavante.com CNAME tooxs-gestion-api.fly.dev` en zona `qavante.com` (Cloudflare, **DNS-only / nube gris**). Fly necesita el CNAME directo para emitir cert Let's Encrypt.
- **Fly:** `fly certs create api.qavante.com` sobre la app `tooxs-gestion-api`. Cert se emite y mantiene automáticamente.
- **FastAPI:** CORS allowlist incluye `https://app.qavante.com` + `http://localhost:3000` con `allow_credentials=true`. Cookie de sesión seteada con `Domain=.qavante.com`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`.
- **Frontend:** `NEXT_PUBLIC_API_URL=https://api.qavante.com` (cambio en `wrangler.toml` cuando BE esté arriba).

## Alternativas consideradas

- **Opción 2: `SameSite=None + Secure` cross-origin (descartada):**
  Funciona inmediatamente sin requerir migración de DNS o cert. Tradeoff: pierde la defensa pasiva de Lax contra CSRF (browsers ya no bloquean cookies cross-site en POST/PUT desde sitios externos). Para Qavante — que maneja datos financieros — la defensa en profundidad importa. Además, la migración a `api.qavante.com` es ~30 min de trabajo del lado backend.

- **Mover todo a un solo host (descartada):**
  E.g., frontend sirviendo `/api/*` como proxy interno al backend. Posible con Workers + service binding o reverse proxy, pero rompe la arquitectura cliente/servidor explícita del proyecto y complica observabilidad (logs partidos entre Worker y Fly).

## Consecuencias

### Positivas

- Cookie cross-subdomain con `SameSite=Lax` — defensa pasiva contra CSRF mantenida.
- Branding API limpio: `https://api.qavante.com` es lo que un futuro cliente B2B / integración externa va a ver.
- `tooxs-gestion-api.fly.dev` queda como nombre interno operativo (puede renombrarse Fase 2 sin afectar consumidores).

### Negativas / tradeoffs aceptados

- Requiere coordinación cross-repo (issue en `qavante-api`).
- Tiempo de propagación del cert Let's Encrypt: minutos a horas en peor caso.
- Si Fly se cae, `api.qavante.com` se cae (no hay multi-provider failover en Sprint C0).

### Acciones que destraba o requiere

- [x] DNS: CNAME `api → tooxs-gestion-api.fly.dev` en Cloudflare, DNS-only (Fernando, 2026-05-12).
- [ ] `fly certs create api.qavante.com` (CC-API — issue qavante-api#58).
- [ ] CORS allowlist FastAPI: `https://app.qavante.com` + `localhost:3000` con `allow_credentials=true` (CC-API).
- [ ] Cookie `qavante_session` con `Domain=.qavante.com`, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/` (CC-API).
- [ ] Flip `NEXT_PUBLIC_API_URL` en `wrangler.toml` (CC-WEB, follow-up PR post-confirmación BE).
- [ ] Update `docs/backend-contracts/c0-auth-and-users.md`: `Domain` field a `.qavante.com` (CC-WEB, mismo PR del flip).
- [ ] Habilitar el test gated en `tests/e2e/prod-health.smoke.spec.ts` con `SMOKE_RUT` + `SMOKE_PASSWORD` cuando exista usuario de prueba (CC-WEB).

## Referencias

- ADR-0002 — dominio oficial `qavante.com`.
- qavante-api issue #58 — cross-repo coordination con CC-API.
- qavante-web PR #25 — Cookie Domain reescrita a host-only como puente hasta esta migración.
- [MDN — SameSite cookies cross-origin behavior](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite).
- Conversación operativa 2026-05-12 (CC-WEB session).
