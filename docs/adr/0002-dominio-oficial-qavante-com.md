# ADR-0002: Dominio oficial `qavante.com` (no `qavante.cl`)

- **Status:** Accepted
- **Fecha:** 2026-05-12
- **Decididores:** Fernando
- **Tickets / PRs:** #22, #23, #25, #26, #27

## Contexto

El Documento Maestro v2.6.3 (y Kit Sprint C0 v1.1) asumían `qavante.cl` (NIC Chile) como dominio de producción. Esa decisión se tomó cuando Qavante era marca local Chile-only.

Al momento de registrar el dominio (mayo 2026), Fernando optó por **registrar `qavante.com` en GoDaddy** en vez de `qavante.cl` en NIC Chile. Razones no documentadas en el doc maestro pero asumidas:

- `qavante.com` deja la puerta abierta a Fase 2 multi-país sin renombrar.
- NIC Chile tiene más fricción operativa (renovaciones, transferencias) que GoDaddy o un registrar internacional.
- El TLD `.com` proyecta marca SaaS profesional para B2B.

La app frontend ya estaba desplegada en Cloudflare Workers al momento de la decisión (Worker `qavante-web` con custom domain a definir). El dominio `qavante.cl` no estaba registrado.

## Decisión

**Dominio oficial del proyecto es `qavante.com`**, registrado en GoDaddy con nameservers migrados a Cloudflare (NS `amanda.ns.cloudflare.com` + `chad.ns.cloudflare.com`). La zona DNS la gestiona Cloudflare.

**Arquitectura de subdominios:**

| Hostname             | Apunta a                             | Propósito                                               |
| -------------------- | ------------------------------------ | ------------------------------------------------------- |
| `qavante.com` (apex) | (libre por ahora)                    | Landing/marketing futura o redirect a `app.qavante.com` |
| `www.qavante.com`    | (libre por ahora)                    | Redirect a apex/app                                     |
| `app.qavante.com`    | Worker `qavante-web` (Custom Domain) | **Frontend Next.js** — la app que usan los clientes     |
| `api.qavante.com`    | CNAME → `tooxs-gestion-api.fly.dev`  | **Backend FastAPI** — ver ADR-0003                      |

## Alternativas consideradas

- **`qavante.cl` en NIC Chile (descartada):**
  La opción del doc maestro original. Tradeoff: branding Chile-explícito, fricción operativa con NIC, encierra el proyecto en un TLD geográfico. Descartada por Fernando al momento de registrar.
- **`qavante.app` en Google Domains (descartada):**
  TLD moderno y específico para apps, pero menos reconocido que `.com` en mercado PYME chileno (público objetivo de Fase 1).
- **Apex `qavante.com` apuntando al Worker directo (descartada por ahora):**
  Simplifica la arquitectura (sin subdominio `app.`), pero deja la apex sin espacio para una landing/marketing separada. Decisión: apex libre, app en `app.`.

## Consecuencias

### Positivas

- Marca internacional, escalable a Fase 2 multi-país sin renombrar.
- GoDaddy + Cloudflare DNS es operativamente más simple que NIC Chile.
- Separación clean entre landing (apex, futura) y app (`app.qavante.com`).
- Subdominio `api.qavante.com` queda libre para que el backend se mueva ahí (ver ADR-0003).

### Negativas / tradeoffs aceptados

- Doc maestro requirió rebuild a v2.6.4 (PR #23) para alinear referencias (sólo había 1 hardcoded: `notify@qavante.cl`).
- Kit Sprint C0 + backend-contracts tuvieron que alinearse (PR #25) — 6 + 2 referencias a `qavante.cl` reemplazadas.
- Custom domain del Worker requiere el subdominio `app.` declarado (PR #27 lo versiona en `wrangler.toml`).

### Acciones que destraba o requiere

- [x] Registro de `qavante.com` en GoDaddy + NS a Cloudflare (Fernando, 2026-05-12).
- [x] Custom Domain `app.qavante.com` en Worker `qavante-web` (PR #27 declarativo).
- [x] Doc maestro v2.6.4 (PR #23) + alineación Kit/contracts/workflow (PR #25).
- [ ] Decisión sobre landing en apex `qavante.com` (Fase 2, no Sprint C0).
- [ ] Posiblemente: mover `tooxs-gestion-api.fly.dev` a `api.qavante.com` (ver ADR-0003).

## Referencias

- Issue #22 — tracker del bump de doc maestro.
- PR #23 — bump Documento Maestro v2.6.3 → v2.6.4.
- Issue #24 — tracker de alineación operativa.
- PR #25 — alinear Kit + backend-contract + workflow URL.
- Issue #26 + PR #27 — wrangler.toml declarativo del Custom Domain.
- ADR-0003 — `api.qavante.com` (decisión derivada para resolver cookie cross-origin).
- Conversación operativa 2026-05-12 (CC-WEB session).
