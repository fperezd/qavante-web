# FE ↔ Backend — roadmap de desbloqueo priorizado

> **CC-WEB → Fernando + CC-API. 2026-06-01.**
>
> El frontend se adelantó: hay features **construidas, testeadas y mergeadas**
> que están **dark** porque dependen de un cambio de backend (no de más código
> FE). El cuello de botella ahora es **destrabar**, no construir. Este doc
> ordena qué desbloquear por **valor de usuario ÷ esfuerzo backend**, y deja
> explícito que del lado FE solo falta **activar un flag** en cada caso.

## Cómo se activa cada feature (FE)

Los flags viven en `wrangler.toml [vars]` (NO en el panel de Cloudflare, que
`wrangler deploy` resetea). Activar = poner `NEXT_PUBLIC_FF_<FLAG> = "true"` +
merge a `main`. **No activar ninguno hasta que su dependencia backend esté
verificada** — varios endpoints gated son **api-key-only**, y un 401 con cookie
puede gatillar el redirect a `/login` del cliente (ver fix #1, PR #269).

## LIVE hoy (referencia)

`cashFlowReport`, `bankMovementClassification`, `classificationRules`,
`managementAccounts` (las 4 de tesorería C3 + el editor de cuentas).

## Cola priorizada (lo gated)

| # | Feature (flag) | Valor usuario | Esfuerzo backend | Dependencia exacta | Estado FE |
|---|----------------|---------------|------------------|--------------------|-----------|
| **1** | **Vistas de gestión** (`managementDimensions`) | **Alto** (mirar el negocio por proyecto/obra/local — núcleo del segmento) | **Bajo** (mismo cambio que ya hicieron para `accounts`) | Cookie `qavante_session` en `GET/POST/PATCH /api/management/dimensions`, `…/{id}/values`, `PATCH /dimension-values/{id}`, `…/move`, `POST/DELETE /dimension-assignments`. Ver [`management-dimensions-cookie-gap.md`](./management-dimensions-cookie-gap.md) | **100% listo** — editor D1+D2+D3 (crear/editar/mover/activar dimensiones y valores + asignar al clasificar). Solo activar flag. |
| **2** | **Mi cuenta** (`miCuenta`) | Medio (todo usuario tiene perfil; baja frecuencia) | **Bajo** (un endpoint) | `PATCH /api/me` (hoy solo GET). Ver [`mi-cuenta-profile-edit-gap.md`](./mi-cuenta-profile-edit-gap.md) | Pantalla + logout listos; edición de nombre espera el PATCH. |
| **3** | **Consultas SII** (`siiQueries`) | **Alto** (F29/RCV/BHE — cumplimiento tributario) | Medio-alto (firma + ambiente SII) | Flujo de credenciales SII operativo end-to-end. Ver [`c1-sii-handoff-runbook.md`](./c1-sii-handoff-runbook.md) | Vistas F29/RCV/BHE + upload de certificado listas. |
| **4** | **Multi-moneda** (`multiCurrency`) | Medio (mayoría CLP; UF/UTM para algunos) | Bajo (cookie) | Cookie en `/api/core/currencies` (api-key-only) | Ajustes de moneda + selectores listos. |
| **5** | **Plantillas de industria** (`industryTemplates`) | Bajo (nicety de onboarding) | Bajo (cookie) | Cookie en `/api/management/industry-templates` | Galería de plantillas lista. |
| **6** | **Inicio MVP** (`inicioMvp`) | Medio (es el landing) | Depende de qué datos consuma | Definir qué agrega sobre el placeholder actual | MVP cableado bajo flag. |

## Recomendación

Atacar en orden **1 → 2 → 3**: #1 (dimensiones) es **alto valor con el menor
esfuerzo backend** (literal el mismo cambio de cookie que ya hicieron para
cuentas en ADR-0027) y el FE ya está 100%. #2 (mi cuenta) es un solo endpoint.
#3 (SII) es alto valor pero más caro. #4-#6 quedan para después.

## Lo que NO es backend (juicio de producto de Fernando)

- Qué muestra exactamente el dashboard de inicio sobre el placeholder.
- Si se prioriza algún flujo nuevo (planificación Fase 2, etc.).

---

_Consolidado por CC-WEB tras el bloque #252-#277. Reemplaza la lectura
dispersa de las brechas individuales en este directorio._
