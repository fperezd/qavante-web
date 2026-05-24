# ADR-0012: Permitir override de feature flags en producción vía Cloudflare Workers env vars

- **Status:** Accepted
- **Fecha:** 2026-05-24
- **Decididores:** Fernando + CC-WEB (rol CTO)
- **Tickets / PRs:** Sprint C1 — pantallas SII listas pero no visibles en prod (#165, #168). Bloqueante similar para Monedas/Reglas/Plantillas (#155-#157) que llevan mergeadas desde 2026-05-22 y siguen invisibles en prod.
- **Supersede parcialmente:** [ADR-0008](./0008-feature-flags-gating-pantallas-sin-backend.md) — invariante "el override env nunca aplica en prod".

## Contexto

[ADR-0008](./0008-feature-flags-gating-pantallas-sin-backend.md) estableció 3
niveles de resolución para feature flags:

1. Override env (`NEXT_PUBLIC_FF_<FLAG>=true|false`) — **explícitamente
   ignorado en `NODE_ENV=production`**.
2. Config inyectada de `GET /api/management/config` (no implementado en
   backend; bloqueante comunicado a CC-API, sin ETA).
3. Default `false`.

El razonamiento original del invariante "no override en prod" fue prevenir
que se habilite accidentalmente una feature en prod por una env var olvidada
en CI/CD. Esa preocupación tenía sentido cuando los flags todavía gateaban
"esqueletos sin backend" — el riesgo del accidente era mostrar UI sin datos
y romper la experiencia del usuario.

**Hoy (2026-05-24) ese contexto cambió:**

- 11 PRs mergeados a `main` han producido features **completas end-to-end**
  con backend live: Monedas (#155), Reglas (#156), Plantillas (#157), Banner
  §18.7 (#158), Sprint C1 SII completo (#165, #168 pendiente).
- El backend NO tiene ETA para `/api/management/config` (último contacto con
  CC-API 2026-05-22). El bloqueante puede durar semanas.
- Estas features **funcionan localmente en dev** (todos los flags ON via
  `.env.local`), están **deployeadas a prod** vía CI/CD, pero quedan
  **invisibles** porque el override env está hard-bloqueado.
- Caso de uso real solicitado por Fernando: ver Sprint C1 en
  `https://app.qavante.com/` para validación interna / demo / piloto con
  primer cliente.

El invariante actual fuerza una espera indefinida por backend para algo que
ya está terminado en frontend. **El gating sigue siendo deseable**
(default OFF en prod es correcto), pero el mecanismo de override necesita
permitir activación intencional en prod.

## Decisión

**Eliminamos el guard `if (NODE_ENV === 'production') return undefined`** de
`resolveFeatureFlag()`. La jerarquía pasa a ser:

1. **Override env explícito** (`NEXT_PUBLIC_FF_<FLAG>="true"|"false"`):
   aplica en **todos los entornos**, incluido prod, si la env var está
   **explícitamente seteada**. Default sigue siendo "ausente → no
   aplica".
2. Config inyectada de `/api/management/config` (cuando exista).
3. Default `false`.

**El gating sigue intencional:** sin env var seteada en Cloudflare Workers
settings, los flags siguen OFF en prod. La activación requiere acción
manual deliberada (setear var en Cloudflare dashboard), no es accidente.

**Defensa contra accidentes preservada:**

- Valores no reconocidos (`"sí"`, `"1"`, `"yes"`) se ignoran y caen al
  default (test cubre).
- La env var ausente sigue dando default `false`.
- El framework Next.js inlinea `NEXT_PUBLIC_*` en build time, lo que
  significa que setear una var en Cloudflare requiere **re-deploy** —
  hay un paso humano explícito entre la decisión y el efecto.

**Naming convention:** las env vars de override en Cloudflare deben
documentarse en `docs/operations/cloudflare-workers-setup.md` para que
cada activación quede trazada.

## Alternativas consideradas

- **Opción A — Esperar `/api/management/config` (descartada):** bloquea
  Fernando indefinidamente. Sin SLA del backend para ese endpoint, no
  es viable.
- **Opción B — Hardcodear default `true` por flag (descartada):** rompe
  ADR-0008 sin nada que lo reemplace; pierde la capacidad de desactivar
  rápido un flag con problemas. Anti-patrón.
- **Opción C — Mock del endpoint `/api/management/config` en el FE
  (descartada):** introduce mock en código de prod, anti-patrón. El FE
  no debe inventar configuración del backend.
- **Opción D — Override prod via env var (elegida):** mantiene el spirit
  de ADR-0008 (default OFF + override intencional) pero remueve la
  restricción hard-coded del entorno prod. La intención de "no accidente"
  se preserva por el requerimiento de setear var explícitamente en
  Cloudflare Workers (acción manual deliberada con re-deploy).

## Consecuencias

### Positivas

- **Desbloquea Sprint C1 + 3 dominios + banner §18.7** en prod sin
  esperar al backend. Total: ~7 features ya mergeadas pasan de "código
  muerto" a "visible y validable".
- **Mantiene gating intencional:** sin env var, sigue OFF. La activación
  requiere acción humana explícita.
- **Coherente con prácticas de la industria:** Next.js, Vercel,
  Cloudflare permiten env vars por ambiente sin gating runtime. Nuestro
  invariante anterior era más restrictivo que el estándar.

### Negativas / tradeoffs aceptados

- **Pierde la red de seguridad "imposible activar en prod por
  accidente"**. Mitigación: documentar las env vars en
  `cloudflare-workers-setup.md`, requerir code review para cambios a esa
  doc, y mantener el default OFF (sin var → OFF, esto sigue siendo el
  comportamiento por defecto).
- **Requiere disciplina operacional:** las env vars de Cloudflare son
  invisibles desde el repo. Hay que mantener `cloudflare-workers-setup.md`
  como fuente de verdad de qué está habilitado en prod.

### Acciones que destraba o requiere

- [x] Cambio en `src/lib/feature-flags.ts` — eliminar guard
      `NODE_ENV === "production"`. Test actualizado.
- [x] Sprint C1 (#168) y los flags Monedas/Reglas/Plantillas/Sug se
      pueden activar en prod via Cloudflare Workers env vars.
- [ ] Fernando setea en Cloudflare dashboard (Workers > qavante-web >
      Settings > Variables): - `NEXT_PUBLIC_FF_SII_QUERIES=true` - `NEXT_PUBLIC_FF_MULTI_CURRENCY=true` - `NEXT_PUBLIC_FF_CLASSIFICATION_RULES=true` - `NEXT_PUBLIC_FF_INDUSTRY_TEMPLATES=true` - `NEXT_PUBLIC_FF_MANAGEMENT_ACCOUNTS=true` - `NEXT_PUBLIC_FF_MANAGEMENT_DIMENSIONS=true` - `NEXT_PUBLIC_FF_BANK_MOVEMENT_CLASSIFICATION=true`
      (deja `PHASE2_PLANNING_PREVIEW` en false — Fase 2 no entra en
      Fase 1)
- [ ] Trigger re-deploy (push vacío o desde Cloudflare dashboard) para
      que `NEXT_PUBLIC_*` se inlineen al bundle.
- [ ] Actualizar `docs/operations/cloudflare-workers-setup.md` con la
      lista de env vars activas en prod (lo hago en este mismo PR).
- [ ] Cuando CC-API exponga `/api/management/config`, este ADR queda
      parcialmente obsoleto: las env vars siguen funcionando pero el
      endpoint pasa a ser fuente preferida. Revisamos en ese momento si
      mantenemos ambos mecanismos o consolidamos.

## Referencias

- [ADR-0008 — Feature flags gating de pantallas sin backend](./0008-feature-flags-gating-pantallas-sin-backend.md)
- [src/lib/feature-flags.ts](../../src/lib/feature-flags.ts) — implementación.
- [PR #165 — Sprint C1 PR-Sii1 data layer SII](https://github.com/fperezd/qavante-web/pull/165)
- [PR #168 — Sprint C1 PR-Sii2+3 views (cherry-picks)](https://github.com/fperezd/qavante-web/pull/168)
