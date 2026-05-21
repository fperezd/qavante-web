# Revisión integral — Ciclo "integración classify + credenciales Opción A" (Anexo K.4)

> **Autor:** CC-WEB (rol CTO) — 2026-05-21
> **Cubre:** todo lo mergeado desde el cierre del ciclo anterior
> ([addendum-skeleton-cycle](./addendum-skeleton-cycle-review.md), PR #104)
> hasta hoy. 8 PRs: #128/#130/#132/#134/#136/#140/#142 mergeados +
> #144 (generate:api refresh) abierto.
> **Método del audit:** verificación directa sobre `main` real
> (no rama de integración sintética — todo ya está mergeado salvo #144,
> que es solo regeneración de `types.ts`).

## TL;DR

- **0 críticos.** Migración credenciales Opción A completa en main;
  flujo §17 (classify drawer) cableado y verificado; bug crítico de
  prod (login `config_missing`) resuelto.
- **🎯 Hito grande:** ambos gates del handoff anterior cerrados (P4-2
  drift SII → Opción A en main; P4-4 canonical_category → 26 valores
  §11 congelados). El **único bloqueante backend restante** es
  `/api/management/config` (no crítico, fallback ADR-0008 cubre).
- **🎉 Backend lanzó los 3 dominios pendientes** (industry-templates,
  core/currencies+exchange-rates+company-settings, classification-rules
  - suggest-rule). PR #144 regenera `types.ts` para destrabar el
    próximo ciclo.
- **Suite en main verde:** typecheck · lint · 110 unit · build · 0 regresión.
- **2 procesos slip honestos** documentados (no daño, recuperados): (1) el
  primer #138 se mergeó en su base stacked orfana (recuperado vía #140);
  (2) la rama remota `feat/credentials-ui-v2-additive` quedó orfana en
  origin (housekeeping menor, no afecta nada).

## #1 — Inventario del ciclo

**PRs mergeados a `main`:**

| PR   | Qué                                                                                                                                                                                 |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #128 | `fix(ops)`: NEXT_PUBLIC_API_URL al build de deploy (login prod roto → resuelto)                                                                                                     |
| #130 | PR6a — capa de datos classify: `useBankMovements` + `useClassifyBankMovement` + `toCanonicalCategoryOptions`. Contrato real verificado (PATCH no POST, sin `dimension_assignments`) |
| #132 | PR6b — wire `/caja/por-clasificar` + `ClassificationDrawer` con classify real (flujo §17 end-to-end)                                                                                |
| #134 | Credenciales Opción A — capa de datos (fase aditiva, `sii_rcv` + certificados multi-holder, 7 hooks)                                                                                |
| #136 | Credenciales Opción A — nuevos componentes (`SiiCredentialCard`/`Dialog`, `CertificateListView`, `CertificateUploadDialogV2`)                                                       |
| #140 | Credenciales Opción A — swap page + delete 12 archivos viejos + cleanup masivo (1692 líneas borradas). **Recovery** del primer #138 (mergeado en base stacked orfana)               |
| #142 | `fix(classification)`: `canSave` del drawer al contrato real (`management_account_id` requerido, no `canonical_category`)                                                           |

**PR abierto para tu merge:**

| PR       | Qué                                                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **#144** | `generate:api` refresh — recoge schemas nuevos del backend (industry-templates, core/currencies\*, classification-rules, suggest-rule). Hygiene, sin consumidores nuevos. |

`main` HEAD: `b8f917b` (Merge #142). Tras mergear #144: queda con
`types.ts` regenerado, listo para que el próximo ciclo conecte los
3 dominios nuevos.

## #2 — Tests (en `main` real)

| Gate             | Resultado                                                              |
| ---------------- | ---------------------------------------------------------------------- |
| `typecheck`      | ✅ limpio (`tsc --noEmit` exit 0)                                      |
| `lint`           | ✅ limpio                                                              |
| `test` (unit)    | ✅ **110/110** (vs 92 al cierre del ciclo anterior — +18 nuevos)       |
| `build`          | ✅ compilación OK, todas las rutas dentro de presupuesto               |
| `size:check`     | ✅ todas las rutas en budget (credenciales 30.4 kB ↓ vs pre-cleanup)   |
| `test:storybook` | ✅ verde en el último ciclo verificado (post-#140 limpieza de stories) |

## #3 — Sin regresiones

- **Navegación:** sidebar de 6 módulos intacto. Landing Administración
  con 6 SubModuleCards (Usuarios, Credenciales SII, Estructura, Vistas,
  Monedas, Reglas). Sin cambios.
- **Login/auth:** sin tocar (fix #128 es config de deploy, no código).
- **Rutas existentes**: `/login`, `/aceptar-invitacion`, `/inicio`,
  `/administracion/usuarios` — sin cambios funcionales.
- **Pantalla `/administracion/credenciales`:** reescrita a Opción A.
  Cambia comportamiento: ya no muestra lista de personas, ahora muestra
  1 bloque SII + lista multi-holder de certificados. **Es el cambio
  esperado por la migración**, no una regresión.
- **Rutas gateadas** (`/administracion/{estructura-gestion,vistas-gestion,
monedas,reglas-clasificacion}` + `/caja/por-clasificar`): en prod
  siguen mostrando FeatureUnavailableState (flags OFF por fallback
  ADR-0008). El cableado real existe pero no se ve hasta que el
  backend exponga `/api/management/config` o se use override dev.
- **Sin deps nuevas.** Sin cambios en `wrangler.toml`/Next config.

## #4 — Coherencia

- **ADR-0007** (sin `src/features/`): respetado — `src/components/clasificacion/`,
  `src/lib/api/treasury.ts`, etc. ✅
- **ADR-0008** (feature flags default OFF + invariante prod-ignore-override):
  respetado. Flags siguen OFF en prod sin `/management/config`. ✅
- **ADR-0009** (DnD/move policy): respetado — drawer wirea reparent vía
  classify; no se agregó @dnd-kit. ✅
- **ADR-0010** (selectores dependency-free): respetado — los selectores
  presentacionales no usan combobox lib. ✅
- **Regla 3** (no hand-edit `types.ts`): respetado — generate:api del
  runbook (#116 + #144). ✅
- **Regla 4** (sin `export const runtime`): respetado — 0 ocurrencias
  en las rutas nuevas. ✅
- **Regla 6** (sin tokens en JS): respetado — passwords nunca se
  almacenan en FE, MSW dev mode setea cookie no-HttpOnly (concesión
  documentada de Service Worker API, no aplica a prod). ✅
- **Regla 16** (no inventar contrato): respetado +**activamente
  aplicado** durante PR6a (verificación que detectó: classify=PATCH no
  POST, sin `dimension_assignments`, `management_account_id`
  requerido). Multi-persona SII confirmado FUERA de scope, no se
  inventaron endpoints de persona. ✅

## #5 — DoD (alcance integración real + credenciales)

| Ítem                                        | Estado                                                |
| ------------------------------------------- | ----------------------------------------------------- |
| Tipos del OpenAPI generado (no hand-rolled) | ✅ treasury/management/credentials consumen generated |
| Flujo §17 cableado end-to-end               | ✅ #132 (lista + drawer + PATCH classify)             |
| Credenciales Opción A migrada               | ✅ #134/#136/#140 (page + componentes + cleanup)      |
| Sin `persons[]` (regla 16)                  | ✅ confirmado FUERA scope; no se inventó              |
| Multi-holder certificates                   | ✅ `CertificateListView` con upload + delete por id   |
| Defense in depth en mutaciones              | ✅ container + drawer canSave aligned                 |
| Sin deps nuevas                             | ✅                                                    |
| Tests + stories siguen verdes               | ✅                                                    |
| Login prod desbloqueado                     | ✅ #128 (caveat: cookie cross-origin qavante-api#58)  |

## #6 — Documentación

- **CHANGELOG [Unreleased]:** consolidado en este ciclo (entradas de
  todos los PRs del ciclo).
- **Reconciliation.md:** P4-2 → ✅ RESUELTO (Opción A en main); P4-3 → 3
  dominios ahora LIVE; P4-5 (nuevo, opcional) — drift classify
  PATCH/POST + sin `dimension_assignments` documentado.
- **Este audit:** cubre los 7 puntos K.4.
- **Memoria cross-sesión:** actualizada al cierre.

## #7 — Lighthouse + bundle

- **Bundle:** `size:check` ✅
  - `/administracion/credenciales`: 30.4 kB / 189 kB (↓ vs pre-cleanup 32.4 kB)
  - `/caja/por-clasificar`: 6.22 kB / 131 kB
  - `/administracion/estructura-gestion`: 5.13 kB / 126 kB
  - `/administracion/vistas-gestion`: 1.19 kB / 126 kB
  - Resto: sin cambios
- **Lighthouse:** gate en CI sobre `/login` (≥0.85) y
  `/administracion/credenciales` (#75). Las pantallas nuevas
  (`por-clasificar`, `estructura-gestion`, `vistas-gestion`) podrían
  sumarse al gate en un futuro PR (no urgente; quedan dentro de
  size:check ya).

## Recomendaciones por severidad

### 🔴 Crítico

Ninguno.

### 🟡 Medio

- **Decisión próximo ciclo:** los 3 dominios desbloqueados
  (industry-templates, currencies, classification-rules) ya están en
  el OpenAPI. PR #144 trae los tipos al repo. **Próxima decisión tuya:**
  qué priorizar — ¿wire Monedas (UI #87 addendum)? ¿Reglas (#88)?
  ¿Industry templates apply (#89)? Mismo patrón data-layer-first
  (#118/#120/#124/#130).

### 🟢 Menor

- **Rama orfana en origin:** `feat/credentials-ui-v2-additive` quedó en
  origin tras el slip del #138. Housekeeping: `gh api -X DELETE
repos/fperezd/qavante-web/git/refs/heads/feat/credentials-ui-v2-additive`
  cuando quieras.
- **Lección operativa:** stacked PRs requieren retarget de la base del
  hijo apenas el padre se mergea, o el hijo se mergea a una rama orfana
  (mismo aprendizaje que `--delete-branch` en #98/#102). Mitigación a
  futuro: evitar stacks profundos o avisarte explícitamente para
  retargetear antes del merge.
- **Chromatic baseline:** tras el merge de #140 hay snapshots
  borradas + page rediseñado → re-aceptar baseline una vez (acción
  manual tuya en chromatic.com).

## Chromatic — qué necesita Fernando

Re-aceptar baseline: ~6 stories borradas (sii-person*, sii-company*,
certificate-\*) + page de credenciales rediseñado a Opción A. Es UI web
autenticada (no acción de repo), tu única intervención.

## Checklist Anexo K.4 — los 7 puntos

1. **Inventario** — ✅ #1.
2. **Tests pasando** — ✅ #2.
3. **Sin regresiones** — ✅ #3 (cambios esperados en credenciales = migración).
4. **Coherencia** — ✅ #4 (ADRs 7/8/9/10, reglas 3/4/6/16).
5. **DoD** — ✅ #5 (integración + credenciales + login fix).
6. **Documentación** — ✅ #6 (CHANGELOG + reconciliation + audit).
7. **Lighthouse/bundle** — ✅ #7 (size gate verde; Lighthouse en CI).

**Veredicto:** ciclo **completado** — migración credenciales Opción A

- integración real (flujo §17) + login prod desbloqueado. Próximo
  ciclo arranca con `types.ts` regenerado y 3 dominios nuevos disponibles;
  necesita tu plan-before-issue para priorizar.

## Apéndice — comandos para reproducir

```bash
# en main, post-merge de #142
git checkout main && git pull --ff-only origin main
rm -rf .next
npm run typecheck && npm run lint && npm run test && npm run build
npm run size:check
npx vitest run --project storybook

# verificar inventario backend
curl -s https://tooxs-gestion-api.fly.dev/openapi.json | node -e "..."
```

---

Generated by CC-WEB — 2026-05-21.
