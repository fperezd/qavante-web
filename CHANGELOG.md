# Changelog

Todos los cambios notables de `qavante-web` se documentan en este archivo.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado **semántico no estricto** durante el Sprint C0 (pre-v1.0): cada Milestone bumpea el `minor` con la fecha del cierre. El Sprint C0 se cerrará con tag `c0-complete-YYYY-MM-DD` (Kit C0-18 DoD).

## [Unreleased]

### Bloque 2026-06-01 (madrugada) — backlog diferido del code-review #3, 6 fixes (Modo A)

PRs #258-#263 (6 mergeados a `main`). Continuación del bloque Modo A: tras cerrar #10 HIGH (#252), Fernando autorizó arreglar **todos** los hallazgos diferidos del 3er code-review. **Backlog del review #3 = 100% cerrado** ([`docs/audits/code-review-findings-round3-2026-05-31.md`](./docs/audits/code-review-findings-round3-2026-05-31.md) marcado resuelto).

#### Fixed

- **#4 (MED, prod) — error de clasificación visible dentro del drawer** ([#258](https://github.com/fperezd/qavante-web/pull/258)) — el `ClassificationDrawer` es overlay `z-50`; un error de `classify` se renderizaba en el flujo de página, **debajo del overlay** → invisible (la clasificación fallaba en silencio). Ahora el error va dentro del drawer (arriba del footer) + `classify.reset()` al cambiar de movimiento/cerrar (sin error stale).
- **#8 (MED) — `qavante-input` preserva el caret al reformatear** ([#263](https://github.com/fperezd/qavante-web/pull/263)) — variants `currency`/`rut` reformateaban en cada tecla y el caret saltaba al final al editar en medio (afectaba el **RUT de login**). Se reancla el caret por chars significativos (sólo si el input está enfocado). Helpers de caret puros (10 tests). **Contrato + validación intactos** → login sin cambio funcional (442 unit tests verdes).
- **#7 (MED) — `currency-code-select` no miente con value fuera de opciones** ([#259](https://github.com/fperezd/qavante-web/pull/259)) — misma clase que #10: un value inactivo/filtrado se mostraba como la primera opción. Ahora `<option value hidden disabled>` "(no disponible)" mantiene el valor real visible.
- **#5 (low) — limpia el default de reporte stale** ([#262](https://github.com/fperezd/qavante-web/pull/262)) — al destildar una moneda de reporte que era el default, el campo quedaba con valor stale invisible; efecto que lo limpia al salir de `reporting_currency_codes`.
- **#9 (low) — `dimension-value-picker` single deselecciona** ([#260](https://github.com/fperezd/qavante-web/pull/260)) — la rama toggle-off de radios era código muerto (un radio ya `checked` no dispara `onChange`); se agregó opción explícita "Sin asignar".
- **#12 (low) — `cash-flow-table` sin `$-0`** ([#261](https://github.com/fperezd/qavante-web/pull/261)) — un neto fraccionario negativo mostraba "$-0" en rojo; helper puro `normalizeNet` (`Math.round(net) || 0`) para formatear y colorear.

### Bloque 2026-05-31 (tarde) — editor completo de Estructura de gestión + fix #10 HIGH (Modo A)

PRs #252-#256 (5 mergeados a `main`). Fernando autorizó un bloque Modo A de ~3h: arreglar el hallazgo HIGH del role-`select` y construir el editor **completo** de `/administracion/estructura-gestion` (que estaba read-only).

#### Fixed (seguridad)

- **#10 HIGH — role-`select` ya no miente ni degrada un owner en silencio** ([#252](https://github.com/fperezd/qavante-web/pull/252)) — el `<select>` de rol en `users-table` filtraba `owner`/`technical_admin` de las `<option>` pero seguía siendo controlado con `value={u.role}`, así que para esos roles mostraba la **primera** opción (mentía) y, si el admin elegía algo, **degradaba al owner sin verlo**. Fix: las filas cuyo rol no es asignable por el usuario actual se renderizan como **texto read-only** (no `select`). Toca RBAC → autorizado por Fernando explícitamente.

#### Added (editor de Estructura de gestión — de read-only a CRUD completo)

Pantalla `/administracion/estructura-gestion` (flag `managementAccounts`, LIVE en prod). Construido en 4 PRs incrementales (cada uno <300 líneas, contract-driven, dialogs lazy admin-only, schema/transforms testeables sin React, frontera de tipos respetada vía `ManagementAccountTreeRow` + adapters):

- **Árbol interactivo + activar/ocultar** ([#253](https://github.com/fperezd/qavante-web/pull/253)) — árbol indentado con badges Inactiva/Oculta, toggles `toggle-active`/`toggle-visible` por nodo, "incluir inactivas", search.
- **Crear cuenta raíz + sub-cuenta** ([#254](https://github.com/fperezd/qavante-web/pull/254)) — botón "Nueva cuenta" + "Agregar sub-cuenta" por nodo; dialog con código/nombre/tipo/destino (de los dominios del árbol)/glosa/afecta-Pulso. 409/422/403 vía `apiErrorToUserMessage`.
- **Editar** ([#255](https://github.com/fperezd/qavante-web/pull/255)) — lápiz por nodo → PATCH de nombre/glosa/afecta-Pulso (lo único mutable vía PATCH; el dialog lo explicita).
- **Mover** ([#256](https://github.com/fperezd/qavante-web/pull/256)) — icono → selector **"Mover a…"** (sin drag-and-drop, [ADR-0009](./docs/adr/0009-politica-drag-and-drop.md)). El selector excluye la propia cuenta + descendientes (`excludeSelfAndDescendants`, puro + testeado) → no se puede generar un ciclo desde la UI; red de seguridad para 422 (ciclo por edición concurrente) con copy específico.

### Sesión autónoma nocturna 2026-05-30/31 — activación prod + 3 code-reviews (Modo A)

PRs #241-#250 (10 mergeados a `main`). Fernando autorizó bloques Modo A para avanzar mientras dormía/estaba afuera.

#### Continuación 2026-05-31 (#248-#250)

- **4ta pantalla de tesorería activada** ([#248](https://github.com/fperezd/qavante-web/pull/248)) — CC-API arregló el 500 de `accounts/tree` (verificado end-to-end) → reactivé `managementAccounts` en `wrangler.toml`. **Las 4 pantallas de tesorería C3 están LIVE en prod.** Bug doc marcado resuelto.
- **3er code-review (forms/mutations/effects)** — 12 hallazgos confirmados. **5 arreglados** ([#249](https://github.com/fperezd/qavante-web/pull/249)): error handling del borrado de certificado (HIGH — unhandled rejection + el prop `error` del diálogo estaba sin cablear), invalidación de cache de `classify` (classification-rules + cash-flow report), guard `\|\| 0` contra `$NaN`, guard de fecha en users-table (un `last_login_at` corrupto rompía el render de toda la tabla). **7 diferidos** ([#250](https://github.com/fperezd/qavante-web/pull/250)) — incl. **#10 HIGH** (users-table role-`select` puede degradar un owner en silencio, toca RBAC → revisión Fernando).

#### Changed (prod)

- **3 pantallas de tesorería C3 ACTIVADAS en prod** ([#241](https://github.com/fperezd/qavante-web/pull/241)) — `cashFlowReport` (`/caja/proyeccion`), `bankMovementClassification` (`/caja/por-clasificar`+`/clasificados`), `classificationRules` (`/administracion/reglas-clasificacion`), vía `wrangler.toml [vars]`. **Descubrimiento clave:** el panel de Cloudflare es **efímero** (`wrangler deploy` resetea las vars del Worker al `wrangler.toml` en cada push), así que los flags **viven versionados en el repo**, no en el dashboard. Runbook corregido. `managementAccounts` queda OFF (backend 500, ver abajo). Deploy verificado OK.

#### Fixed (code-review multi-agente — 2 pasadas, 24 hallazgos confirmados, 12 arreglados)

- **Lógica pura** ([#246](https://github.com/fperezd/qavante-web/pull/246)) — 7 bugs + 10 tests: `confidence=""` → falso positivo "needs review"; `classified_at` comparado lexicográfico → por instante; `formatPeriodLabel("2026-13")` híbrido → fallback; RUT cero aceptado → rechazado; `formatLastLogin` sin `timeZone` → **mostraba hora UTC en prod (Cloudflare)** → pinea `America/Santiago`; filtro de solo-diacríticos devolvía toda la lista → `[]`.
- **i18n + a11y + correctitud** ([#244](https://github.com/fperezd/qavante-web/pull/244)) — 3 voseos "Podés"→"Puedes" en copy visible (+ comentario), fallback de nombre vacío en inicio, `aria-label` distintivo en botones "Clasificar".
- **Test flaky `expiration-banner`** ([#243](https://github.com/fperezd/qavante-web/pull/243)) — fallaba ~1/6 por race de `Date.now()` vs `new Date()` interno → tiempo congelado con `vi.useFakeTimers`. Suite ahora 100% determinista.

#### Docs / handoffs

- **Bug backend `accounts/tree` 500 + 500-sin-CORS** ([#240](https://github.com/fperezd/qavante-web/pull/240)) — hallado activando tesorería: el endpoint 500ea para el tenant real y los 500 pierden headers CORS (el FE lo ve como "perdiste conexión"). Handoff preciso a CC-API.
- **Cookie demo investigada** ([#242](https://github.com/fperezd/qavante-web/pull/242)) — el FE NO setea `qavante_session` en prod; falso positivo #194 confirmado.
- **5 hallazgos diferidos del code-review** ([#245](https://github.com/fperezd/qavante-web/pull/245)) — los que tocan auth/middleware (`client.ts` 401-redirect, `/mi-cuenta` sin gate) o son juicio, documentados para revisión de Fernando.

### Sesión autónoma 2026-05-30 (tarde) — unblock tesorería C3 + limpieza + stories (Modo A)

PRs #229-#238 (10 mergeados a `main`). Continuación supervisada/autónoma (Fernando intermitente). Highlight: **respuesta a la nota de CC-API-A en `STATE_OF_THE_TRAIN` → ADR-0027 destrabó la Brecha 0 para tesorería C3.**

#### Unblocked / Changed

- **`generate:api` tras ADR-0027** ([#233](https://github.com/fperezd/qavante-web/pull/233)) — el backend (ADR-0027, live prod) hizo que **5 grupos de endpoints de tesorería C3 acepten la cookie `qavante_session`** del FE (resuelve la **Brecha 0** para esos grupos: `bank-movements`, `treasury/canonical-categories`, `treasury/classification-rules`, `treasury/reports/cash-flow`, `management/accounts/tree`). `types.ts` sincronizado — diff 100% aditivo (param `cookie`), `tsc` verde → las vistas ya cableadas son contract-compatible. Verificado por `curl` (`no_session` vs `Falta X-Api-Key`).
- **Handoff de activación + Brecha 0 resuelta-parcial** ([#234](https://github.com/fperezd/qavante-web/pull/234), [`docs/operations/treasury-c3-activation-2026-05-30.md`](./docs/operations/treasury-c3-activation-2026-05-30.md)) — 4 flags activables ya (`cashFlowReport`, `bankMovementClassification`, `classificationRules`, `managementAccounts`) con pasos Cloudflare; residual aún bloqueado (`management/dimensions`, `core/currencies`, `sii/*`) marcado como handoff para CC-API.

#### Removed

- **Dead code `src/components/ui/`** ([#229](https://github.com/fperezd/qavante-web/pull/229)) — 9 primitivas shadcn sin uso (0 imports, tokens fuera del DS Qavante). `tsc` + 393 tests verdes tras el borrado.

#### Tested (stories de container-views con MSW)

- `TemplatesGalleryView` ([#230](https://github.com/fperezd/qavante-web/pull/230)), `RulesListView` ([#231](https://github.com/fperezd/qavante-web/pull/231)), `CertificateListView` ([#232](https://github.com/fperezd/qavante-web/pull/232)), `CashFlowView` ([#235](https://github.com/fperezd/qavante-web/pull/235)), `PorClasificarView` ([#236](https://github.com/fperezd/qavante-web/pull/236)), `ManagementAccountsView` ([#237](https://github.com/fperezd/qavante-web/pull/237)), `ManagementDimensionsView` ([#238](https://github.com/fperezd/qavante-web/pull/238)) — 4 estados cada una (datos/vacío/loading/error 500) con handlers MSW. Cobertura visual de las pantallas de tesorería que quedan activables.

### Sesión autónoma 2026-05-30 — confirmación logout + coverage + brecha perfil (Modo A)

PRs #217-#227 (11 mergeados a `main`). Continuación del ciclo Mi cuenta; Fernando autorizó ~6h en Modo A ([ADR-0014](./docs/adr/0014-sesiones-autonomas-low-risk.md)) eligiendo (A) confirmación de logout + (B) pivot a coverage low-risk.

#### Added

- **Confirmación antes de cerrar sesión** ([#217](https://github.com/fperezd/qavante-web/pull/217)) — el botón "Cerrar sesión" abre un `LogoutConfirmDialog` dedicado y **neutro** (no reusa `DeleteConfirmDialog`, que es destructivo) para evitar el logout accidental. Bajo flag `miCuenta` OFF. + 3 stories.
- **Brecha backend `PATCH /api/me`** ([#222](https://github.com/fperezd/qavante-web/pull/222), [`docs/backend-contracts/mi-cuenta-profile-edit-gap.md`](./docs/backend-contracts/mi-cuenta-profile-edit-gap.md)) — handoff CC-WEB→CC-API para editar el perfil propio (campo `name`). Documenta por qué `/mi-cuenta` queda solo-lectura: `/api/me` es solo GET y `PATCH /api/users/{id}` es gestión admin.

#### Tested (coverage anti-regresión, sin cambios de runtime)

- **`formatRut`** ([#218](https://github.com/fperezd/qavante-web/pull/218)) — 8 tests sobre normalización + formateo del RUT chileno (identidad crítica).
- **`ApiError`** ([#219](https://github.com/fperezd/qavante-web/pull/219)) — 10 tests de construcción + predicados de status (gobiernan el mapeo error→copy del Anexo C.3).
- **`formatClp` / `formatDate` / `isClpAmount`** ([#220](https://github.com/fperezd/qavante-web/pull/220)) — 11 tests de caracterización (formato de plata/fecha, guard de monto).
- **Cliente HTTP `api/client`** ([#221](https://github.com/fperezd/qavante-web/pull/221)) — 8 tests de `request()`: parseo, 204, `ApiError` desde no-OK, error de red, y el flujo 401→refresh→retry. Env fijada con `vi.hoisted` (no `resetModules`, que rompería `instanceof ApiError`).
- **Helpers de auth** ([#225](https://github.com/fperezd/qavante-web/pull/225)) — 10 tests de `auth()`, `requireAuth()` y `SESSION_COOKIE_NAME`. Incluye el **boundary de seguridad** del override `qavante_test_role` (solo aplica con `NEXT_PUBLIC_API_MOCKING=enabled`). Solo lectura, cero cambios de runtime de auth.
- **`ClasificadosStatCard`** ([#223](https://github.com/fperezd/qavante-web/pull/223)) — 6 stories cubriendo estados (info/clickeable/activa/muted/warning/truncado).
- **`LoginForm`** ([#226](https://github.com/fperezd/qavante-web/pull/226)) — story de la pantalla de login. **Primera story del repo con hooks de App Router**: establece el patrón `parameters.nextjs.appDirectory: true` (+ `navigation.pathname`) para `useRouter`/`useSearchParams`/`usePathname`.
- **`AppSidebar`** ([#227](https://github.com/fperezd/qavante-web/pull/227)) — 4 stories del gating de Administración por rol (owner sí, viewer no, sin-rol default seguro, drawer mobile). Usa el patrón App Router de #226.

### Ciclo "Mi cuenta + logout" (2026-05-29 — sesión autónoma Modo A)

PRs #213-#215 (3 mergeados a `main`). Sesión autónoma Modo A ([ADR-0014](./docs/adr/0014-sesiones-autonomas-low-risk.md)), scope "Extender Mi cuenta".

#### Added

- **Pantalla `/mi-cuenta` + logout** ([#213](https://github.com/fperezd/qavante-web/pull/213)) — perfil del usuario logueado (nombre, correo, empresa, rol, último ingreso) consumiendo `GET /api/me`, + **Cerrar sesión** vía `POST /api/auth/logout` (revocación server-side real C0-15). Gated por el flag nuevo `miCuenta` (default OFF, patrón "MVP honesto" [ADR-0013](./docs/adr/0013-treasury-reports-mvp-honest-no-invention.md)). El avatar del header enlaza a la ruta. Logout trata el 401 como éxito funcional (`handleLogoutError`, helper puro testeado) y redirige con `window.location.href` para reset completo del state cliente.
- **Feature flag `miCuenta`** agregado a `FEATURE_FLAGS` + entry en `FLAG_GATING_ENDPOINT` (`/api/auth/logout` — capacidad única vs. inicio, mantiene el invariante 1-a-1). Default OFF; activar con `NEXT_PUBLIC_FF_MI_CUENTA=true` en Cloudflare Workers + redeploy. Runbook + tabla en [`docs/operations/feature-flags-activation.md`](./docs/operations/feature-flags-activation.md).
- **Stories de `MiCuentaContent`** ([#214](https://github.com/fperezd/qavante-web/pull/214)) — 6 stories cubriendo roles (owner/admin/finance_manager/viewer) + edge cases (sin nombre, sin último login). Cobertura visual Chromatic + render test del proyecto `storybook` de vitest.
- **Stories de estados de `MiCuentaView`** ([#215](https://github.com/fperezd/qavante-web/pull/215)) — container con MSW: loading (skeleton vía `delay("infinite")`), error 500 (`QavanteInlineError`), éxito (perfil + logout). Mirror del patrón `f29-view.stories`.

### Ciclo "i18n cleanup + login fix + Sprint C3 MVP + sesión autónoma" (2026-05-27 → 2026-05-28)

PRs #186-#206 (15 mergeados a `main`) + issue #194 (cerrado por falso positivo). Audit K.4 en [`docs/audits/c3-mvp-cycle-2026-05-27-28.md`](./docs/audits/c3-mvp-cycle-2026-05-27-28.md).

#### Added

- **Sprint C3 MVP — `/caja/proyeccion`** ([#196](https://github.com/fperezd/qavante-web/pull/196)) — cablea `GET /api/treasury/reports/cash-flow` del backend con default `granularity=week` + 3 meses (≈13 semanas) + `financial_layer=committed`. Gated por flag `cashFlowReport` (default OFF). No inventa lógica financiera en FE (regla 5 + addendum §25.3 + ADR-0013).
- **Smoke E2E gated post-deploy** ([#195](https://github.com/fperezd/qavante-web/pull/195)) — cableo de `SMOKE_RUT` + `SMOKE_PASSWORD` en step `smoke` del workflow `deploy-cloudflare.yml`. El spec `prod-health.smoke.spec.ts > login flow (gated)` se activa cuando Fernando agrega los secrets en GH Actions (acción humana pendiente).
- **ADR-0013 — Treasury reports MVP honesto** ([#201](https://github.com/fperezd/qavante-web/pull/201)) — establece patrón replicable C4-C8: exponer crudo del backend, no inventar lógica, documentar brechas, esperar contrato.
- **Handoff backend para Sprint C3 waves 2-5** ([#200](https://github.com/fperezd/qavante-web/pull/200), [`docs/backend-contracts/c3-treasury-reports-gaps.md`](./docs/backend-contracts/c3-treasury-reports-gaps.md)) — 4 brechas (caja mínima, acciones recomendadas, bank-accounts list, scenario versions) con shapes sugeridos. Brief para que CC-API + Fernando decidan shape óptimo.
- **Runbook activación de feature flags** ([#203](https://github.com/fperezd/qavante-web/pull/203), [`docs/operations/feature-flags-activation.md`](./docs/operations/feature-flags-activation.md)) — guía completa: mapping flag → env var → endpoint, steps en CF Workers + redeploy, kill-switch, errores comunes, checklist para agregar un flag nuevo.
- **Coverage de helpers puros C3 MVP** ([#199](https://github.com/fperezd/qavante-web/pull/199)) — extrae `parseDecimal`, `formatPeriodLabel`, `isValidPeriod`, `isValidPeriodRange`, `PERIOD_REGEX` a `cash-flow-format.ts` + exporta `buildCashFlowQuery`. +51 tests anti-regresión (vitest unit).
- **Tests de consistencia flag mapping** ([#205](https://github.com/fperezd/qavante-web/pull/205)) — +7 tests anti-regresión de `FEATURE_FLAGS` ↔ `FLAG_GATING_ENDPOINT` (each-has-entry, no-extras, env-var-format, no-duplicates, 1-a-1).
- **Audit K.4 del ciclo** ([#202](https://github.com/fperezd/qavante-web/pull/202)) — `c3-mvp-cycle-2026-05-27-28.md` con TL;DR, inventario, tests, ADRs nuevos, brechas backend, sesión autónoma, acciones pendientes humano, estado al cierre.
- **Feature flag `cashFlowReport`** agregado al array `FEATURE_FLAGS` + entry en `FLAG_GATING_ENDPOINT` (`/api/treasury/reports/cash-flow`). Default OFF; activar con `NEXT_PUBLIC_FF_CASH_FLOW_REPORT=true` en Cloudflare Workers + redeploy.

#### Fixed

- **`fix(ops)`: flipear `NEXT_PUBLIC_API_URL` a `api.qavante.com`** ([#193](https://github.com/fperezd/qavante-web/pull/193)) — cierra el último checkbox pendiente de [ADR-0003](./docs/adr/0003-api-qavante-com-shared-parent.md). Login en prod estaba pegado en `/login` post-submit porque la cookie quedaba bajo `fly.dev` y el middleware Next.js en `app.qavante.com` no la veía. Flip de `wrangler.toml` + workflow `deploy-cloudflare.yml` + update de `c0-auth-and-users.md` (campo `Domain` ahora `.qavante.com`). Verificado post-deploy con Network tab: backend emite JWTs HS256 firmados con `Domain=.qavante.com`, `HttpOnly`, `Secure`, `SameSite=lax`.
- **`chore(api)`: flipear `npm run generate:api` a `https://api.qavante.com/openapi.json`** ([#198](https://github.com/fperezd/qavante-web/pull/198)) — followup ADR-0003. CONTRIBUTING.md sincronizado quitando caveat de migración.
- **`fix(i18n)`: chileno neutro al 100% en copy UI + comentarios** ([#186](https://github.com/fperezd/qavante-web/pull/186)/[#188](https://github.com/fperezd/qavante-web/pull/188)/[#189](https://github.com/fperezd/qavante-web/pull/189)/[#190](https://github.com/fperezd/qavante-web/pull/190)/[#191](https://github.com/fperezd/qavante-web/pull/191)/[#192](https://github.com/fperezd/qavante-web/pull/192)/[#197](https://github.com/fperezd/qavante-web/pull/197)) — 7 PRs (parts 1-7) convirtieron toda la copy UI del producto y comentarios voseo argentinos a tuteo chileno neutro. ~85 líneas tocadas en ~40 archivos. Política aplicada: "acá" panhispánico se respeta, "vas a + inf." es futuro perifrástico tuteo válido.

#### Changed

- **README.md** ([#206](https://github.com/fperezd/qavante-web/pull/206)) — sección "Estado" pasa de "Sprint C0" a tracker general C0-C5+. Links al runbook de feature flags, ADR-0013, los 4 audits K.4. `NEXT_PUBLIC_API_URL` default muestra `api.qavante.com` (no fly.dev).
- **`.gitignore`** ([#204](https://github.com/fperezd/qavante-web/pull/204)) — ignora brand assets binarios (`Logo Qavante.png`, `Manual_de_Marca_Qavante.pdf`, `Qavante_assets/`) que aparecían como untracked persistentes.

#### Closed (issues)

- [#194](https://github.com/fperezd/qavante-web/issues/194) — `qavante_session=demo-2026-05-13` (falso positivo, cache stale del browser). Backend actual emite JWTs correctos. Lección: si reaparece el síntoma, clear cookies de `.qavante.com` primero.

#### Sesión autónoma 2026-05-27 23:00 → 2026-05-28 ~04:00 (Chile)

Fernando autorizó shipping low-risk nocturno con restricciones: docs, coverage no-auth, handoffs, memorias. Sin tocar auth/login/cookies. Sin invasión a `qavante-api`. Cada PR independiente con auto-merge si CI verde.

Output autónomo: PRs #197/#198/#199/#200/#201/#202/#203/#204/#205/#206. Sin slips. Sin reverts.

### En curso (C1 prep — sin dependencias `qavante-api`)

Ciclo autónomo 2026-05-13 → 2026-05-16 con autorización owner. Adelanta el frontend de tickets que dependen de backend bloqueado, todos mockeados con MSW (ver ADR-0005). Incluye cierre del Design System (Storybook + Chromatic), audit K.4 del ciclo, runbooks de handoff cross-agente y formalización del Addendum Frontend v2.0.

#### Added

- **C1 prep — MSW v2 setup** ([#55](https://github.com/fperezd/qavante-web/pull/55), ADR-0005) — Mock Service Worker con triple guard contra activación en prod. Handlers para auth + users alineados a contrato C0. 11 sanity tests nuevos.
- **C1 prep — Contrato SII credentials** ([#58](https://github.com/fperezd/qavante-web/pull/58), [`docs/backend-contracts/c1-sii-credentials.md`](./docs/backend-contracts/c1-sii-credentials.md)) — 6 endpoints documentados (empresa + personas + certificado digital PKCS#12) con 10 restricciones de seguridad no-negociables.
- **C1 prep — UI Administración → Credenciales SII** ([#59](https://github.com/fperezd/qavante-web/pull/59)) — `/app/administracion/credenciales` con 3 cards (Empresa + Personas + Certificado) + 7 componentes nuevos. Handlers MSW para los 6 endpoints. 9 tests sanity. ADR-0006 (Deferred) registra decisiones backend pendientes (KMS / storage / audit).
- **Mobile responsive Playwright spec** ([#60](https://github.com/fperezd/qavante-web/pull/60), audit K.4 #3) — `playwright.config.ts` refactor a 2 projects (`http` + `mobile`). 4 specs cubriendo rutas públicas en viewport Pixel 5 con check anti-overflow horizontal.
- **A11y improvements (skip link + aria-current + landmark labels)** ([#64](https://github.com/fperezd/qavante-web/pull/64)) — `SkipLink` component, `aria-current="page"` en sidebar links activos, `aria-label`s en aside/main/breadcrumbs. Mejora SR navigation sin cambios visuales.
- **Unit tests para `format.ts` + `expiration-banner` extraídos** ([#65](https://github.com/fperezd/qavante-web/pull/65)) — extracción de helpers de `certificate-card.tsx` a módulos testables: `format.ts` (formatDateEsCL, daysUntilExpiration) + `expiration-banner.ts` (tone calc). 13 tests anti-regresión.
- **Unit tests para `isValidRut` + `apiErrorToUserMessage`** ([#67](https://github.com/fperezd/qavante-web/pull/67)) — 13 + 15 tests cubren validación RUT chileno (DV módulo 11) + mapping Anexo C.3 de error técnicos a copys usuario.
- **Tech-debt issues registrados**: [#56](https://github.com/fperezd/qavante-web/issues/56) (SSO Google/MS deferred a Fase 2) + [#68](https://github.com/fperezd/qavante-web/issues/68) (Playwright + MSW combo mobile para rutas protegidas) + [#69](https://github.com/fperezd/qavante-web/issues/69) (Storybook setup deferred) + [#71](https://github.com/fperezd/qavante-web/issues/71) (cross-repo handoff backend SII).
- **Playwright + MSW combo para rutas protegidas mobile** ([#73](https://github.com/fperezd/qavante-web/pull/73), cierra [#68](https://github.com/fperezd/qavante-web/issues/68)) — `protected-routes.mobile.spec.ts` (Pixel 5) sobre `/app/*` con cookie injection + `qavante_test_role` + `NEXT_PUBLIC_TEST_MODE=playwright` (cuarto guard MSW para builds prod de Playwright). 5 specs.
- **Lighthouse mobile en `/administracion/credenciales`** ([#75](https://github.com/fperezd/qavante-web/pull/75)) — primera ruta protegida en el gate Lighthouse (cookie dummy vía `extraHeaders`, sin MSW → mide bundle real del shell `(app)`). Threshold 0.85.
- **Storybook 10 — Design System Qavante** ([#77](https://github.com/fperezd/qavante-web/pull/77) Capa 1, [#78](https://github.com/fperezd/qavante-web/pull/78) Capa 2, cierra [#69](https://github.com/fperezd/qavante-web/issues/69)) — `@storybook/nextjs-vite`, 19 componentes / ~80 stories (6 Capa 1 design system + 13 Capa 2 admin/credenciales). Co-located `*.stories.tsx`. Addons `addon-a11y` + `addon-docs`. `storybook-static/` gitignored, fuera del bundle Cloudflare.
- **Storybook tests vía Vitest** ([#81](https://github.com/fperezd/qavante-web/pull/81)) — `vitest.config.ts` a `projects[]`: proyecto `unit` (74 tests, rápido) + proyecto `storybook` (86 tests browser Chromium vía `@vitest/browser-playwright`). `npm run test` queda en `unit`; `test:storybook` opt-in + job CI separado. Playwright alineado a 1.60.0 (fix mismatch de browser revision).
- **Chromatic visual regression** ([#79](https://github.com/fperezd/qavante-web/pull/79) setup, [#88](https://github.com/fperezd/qavante-web/pull/88) anti-flakiness) — workflow `chromatic.yml` gated por secret, baseline de 86 snapshots operativo. Config anti-flakiness (`pauseAnimationAtEnd`/`delay`/`diffThreshold`) elimina falsos positivos de stories con `animate-spin`.
- **Audit K.4 del ciclo c1-prep** ([#76](https://github.com/fperezd/qavante-web/pull/76), [`docs/audits/c1-prep-review.md`](./docs/audits/c1-prep-review.md)) — revisión integral: 0 críticos, 1 medio (backend bloqueado), 5 menores. Suite verde.
- **Runbook handoff cross-agente SII** ([#82](https://github.com/fperezd/qavante-web/pull/82), [`docs/backend-contracts/c1-sii-handoff-runbook.md`](./docs/backend-contracts/c1-sii-handoff-runbook.md)) — procedimiento de 6 pasos CC-WEB↔CC-API con Fernando de puente + brief listo + plan de integración FE post-handoff.
- **Formalización Addendum Frontend v2.0 + reconciliación CTO** ([#83](https://github.com/fperezd/qavante-web/pull/83)) — `.docx` binario de la raíz → [`docs/addendum/frontend-v2.md`](./docs/addendum/frontend-v2.md) (transcripción fiel) + [`reconciliation.md`](./docs/addendum/reconciliation.md) resolviendo P0 (backend no expone endpoints — verificado contra OpenAPI prod) + 4 contradicciones P1 (gana repo/CLAUDE.md).
- **ADR-0007/0008/0009** ([#86](https://github.com/fperezd/qavante-web/pull/86)) — estructura de carpetas dominios addendum (no `src/features/`), feature flags gating, política drag-and-drop preventiva.
- **Brief 2º handoff backend (taxonomía/gestión/multimoneda)** ([#87](https://github.com/fperezd/qavante-web/pull/87), [`docs/addendum/taxonomy-handoff-brief.md`](./docs/addendum/taxonomy-handoff-brief.md)) — handoff de co-diseño para CC-API (contrato NO existe, a diferencia de SII). 7 dominios priorizados + 6 decisiones que CC-API debe resolver.
- **Verificación dura OpenAPI prod 2026-05-16 + P3/P4 reconciliación** ([#93](https://github.com/fperezd/qavante-web/issues/93)) — `reconciliation.md` P3 (datos del Addendum Técnico Escalamiento: `canonical_category` enum 16 valores, syncs async-task) + **P4** (verificación `curl /openapi.json`: 73 paths, mayor parte de taxonomía/gestión **LIVE**, P0 invertido). Documenta el **drift de credenciales SII** (`admin/sources` genérico vs contrato `/credentials/sii`) como decisión pendiente de Fernando (regla 16 — no se parchea en silencio). **P4-4 revierte P3-1**: el contrato vivo de `canonical_category` es la taxonomía de 26 valores del addendum §11 con labels (`CanonicalCategoryMeta`, §10.1), no el enum de 16 de migration 0026 (ausente del API público) — contradicción doc-backend ↔ API-vivo ruteada a CC-API. `taxonomy-handoff-brief.md` DoD + §4 actualizados a estado parcial/corregido.
- **Feature-flags módulo (ADR-0008)** ([#96](https://github.com/fperezd/qavante-web/pull/96)) — `src/lib/feature-flags.ts`: 7 flags tipados, default seguro `false`, override env `NEXT_PUBLIC_FF_*` (ignorado en prod), seam `config` inyectable para el futuro `GET /api/management/config` (ausente — verificado 2026-05-16). 12 unit tests. CONTRIBUTING + nota de estado en ADR-0008. Sin integración real (patrón, no datos).
- **Esqueletos de ruta gateados + FeatureUnavailableState** ([#107](https://github.com/fperezd/qavante-web/pull/107), reemplazó al auto-cerrado #98) — 5 rutas Server Component gateadas por flag OFF (`/administracion/{estructura-gestion,vistas-gestion,monedas,reglas-clasificacion}` + `/caja/por-clasificar`, addendum §14-§18) + `FeatureUnavailableState` (wrapper de `QavanteEmpty`, §20/§23.1) + story + links en landing Administración (sidebar plano, §9.1). Sin `export const runtime`, sin deps, sin tocar nav/rutas existentes.
- **Selectores presentacionales de clasificación** ([#100](https://github.com/fperezd/qavante-web/pull/100)) — `src/components/clasificacion/`: `CanonicalCategorySelect` (§17.2/§20), `ManagementAccountSelect` (árbol+search, §20), `DimensionValuePicker` (respeta `allowsMultiple`, §15.5) — prop-driven puros, sin fetch/tipos generados. Helper `filter.ts` (substring, acento-insensible) + 6 tests. Fixtures de stories fundadas en el contrato vivo §11/26. 8 stories Capa 2.
- **ClassificationDrawer — shell presentacional** ([#108](https://github.com/fperezd/qavante-web/pull/108), reemplazó al auto-cerrado #102) — drawer §17.2 que compone los 3 selectores; estado de formulario local, emite `ClassificationDraft` por callbacks (sin mutación/fetch). Resumen read-only (§17.4). A11y: `role=dialog`+`aria-modal`+Esc+focus management WCAG. 3 stories.
- **ADR-0010 — selectores sin librería combobox** ([#106](https://github.com/fperezd/qavante-web/pull/106)) — formaliza la decisión dependency-free (input + lista nativa accesible), evaluación de combobox diferida y condicionada (análogo a ADR-0009/DnD) + invariantes de a11y (no anidar interactivos en `role=listbox`).
- **Audit K.4 del ciclo addendum-skeleton** ([#104](https://github.com/fperezd/qavante-web/pull/104), [`docs/audits/addendum-skeleton-cycle-review.md`](./docs/audits/addendum-skeleton-cycle-review.md)) — revisión integral sobre rama de integración: 0 críticos, 2 escalamientos 🟡 a Fernando (drift SII P4-2, `canonical_category` P4-4), 1 flake unit transitorio. Suite integrada verde. + adenda post-audit (ADR-0010 + corrección a11y del patrón ARIA en selectores/drawer antes de merge).

> **Estado al cierre del ciclo (2026-05-16):** los 7 PRs anteriores **mergeados a `main`**; suite verde en `main` real (typecheck/lint/92 unit/build/size/100 storybook). Todo aditivo y gateado OFF — **`generate:api` e integración real siguen DEFERIDOS** hasta resolver las 2 decisiones (drift credenciales SII P4-2 + `canonical_category` doc-backend vs API-vivo P4-4, ver [`reconciliation.md`](./docs/addendum/reconciliation.md)).
>
> **Actualización 2026-05-17:** **P4-4 ✅ RESUELTO** por CC-API (R-2, ratificado por Fernando): gana la taxonomía §11/26 congelada; la lista de 16 (AD-ESC #6) descartada formalmente (nunca existió la migración). Cero rework FE. CC-API publicó el OpenAPI formal de taxonomía. **P4-2 ✅ DECIDIDO** (Fernando, Opción 1): el FE se adapta al modelo genérico `/api/admin/sources/*` (superset verificado del contrato SII; `c1-sii-credentials.md` queda superseded). **Ambos gates resueltos** → `generate:api` desbloqueado (verificado: nada importa `types.ts`, regenerar es aditivo y no rompe build). Pendiente acotado a CC-API: representación multi-persona SII. Próximo: integración real (taxonomía) detrás de feature flags.

### Ciclo "integración classify + credenciales Opción A" (2026-05-17 → 2026-05-21)

#### Added

- **`generate:api` post-handoff (#116)** + ciclo de integración taxonomía: `useCanonicalCategories`/`useManagementAccountsTree`/`useManagementDimensions`/`useDimensionValues` (#118/#120/#124) + adapters puros (`flattenManagementAccounts`, `dimensionTypeLabel`) + wire de `/administracion/{estructura-gestion,vistas-gestion}` a datos reales detrás de flags (#122/#126). Patrón "página = contenedor" (cf. usuarios). Sin UI mock — gateado por ADR-0008.
- **Capa de datos classify** ([#130](https://github.com/fperezd/qavante-web/pull/130)) — `useBankMovements` + `useClassifyBankMovement` (PATCH) + `toCanonicalCategoryOptions`. **Contrato real verificado (regla 16):** classify es **PATCH** (no POST como decía addendum §17.3) y `ClassifyMovementRequest` **NO** lleva `dimension_assignments` (asignar dimensión = endpoint aparte); `management_account_id` es **obligatorio** (422 sin él). 13 tests.
- **Wire `/caja/por-clasificar` + `ClassificationDrawer` (flujo §17 end-to-end)** ([#132](https://github.com/fperezd/qavante-web/pull/132)) — `PorClasificarView`: lista movimientos `status=unclassified` → drawer cableado a canonical+accounts reales → PATCH classify. `dimensions={[]}` (sin asignación, no inventar — regla 16); `onMarkForReview`= no-op (no hay endpoint). Defense in depth: guard de `management_account_id` en container. §17.4 respetado (resumen read-only). Fix de fidelidad: fixture MSW `transaction_date`→`date` (shape real `BankMovement`).
- **Credenciales SII — Opción A** ([#134](https://github.com/fperezd/qavante-web/pull/134) data layer aditivo / [#136](https://github.com/fperezd/qavante-web/pull/136) nuevos componentes aditivos / [#140](https://github.com/fperezd/qavante-web/pull/140) swap page + cleanup masivo, recovery del primer #138 mergeado en base stacked orfana) — migración completa al modelo genérico `/api/admin/sources/sii_rcv/credential|test` + colección multi-holder `/api/admin/certificates` (decidido por Fernando 2026-05-18, R-2). Nuevos componentes: `SiiCredentialCard`/`Dialog`, `CertificateListView`, `CertificateUploadDialogV2`. **DELETE 12 archivos viejos** (sii-person*, sii-persons-list, sii-company-*, certificate-\* legacy + stories), borra ~125 líneas deprecated en `credentials.ts`, viejos handlers/db/fixtures + 9 tests del viejo contrato. `c1-sii-credentials.md` SUPERSEDED. `persons[]` **fuera de scope** (no inventar, regla 16 confirmada por backend). 7 hooks + 7 tests V2 + 3 stories nuevas.

#### Fixed

- **`fix(ops)`: login prod roto por `NEXT_PUBLIC_API_URL` ausente en el build** ([#128](https://github.com/fperezd/qavante-web/pull/128)) — `NEXT_PUBLIC_*` se inlinea en build-time; el step `Build OpenNext worker bundle` no lo tenía en `env:` → `API_URL=""` → `config_missing` en client.ts. Fix: 1 archivo, +8 (workflow). Caveat: el login end-to-end **también** depende de la cookie cross-origin (qavante-api#58).
- **`fix(classification)`: `canSave` del drawer al contrato real** ([#142](https://github.com/fperezd/qavante-web/pull/142)) — gateaba por `canonical_category` (supuesto addendum §17.3 erróneo); el contrato real exige `management_account_id`. 1 línea + comentario. Defense in depth del container (#132) se mantiene.

#### Changed

- **`generate:api` refresh post-unlock 2026-05-21** ([#144](https://github.com/fperezd/qavante-web/pull/144)) — el backend lanzó los 3 dominios pendientes: `/api/management/industry-templates` + `apply`, `/api/core/currencies` + `exchange-rates` + `company-currency-settings`, `/api/treasury/classification-rules` + `toggle-active`, `/api/bank-movements/{id}/suggest-rule`, + `/api/bank-movements/bice/*` (BICE, fuera de addendum). `types.ts` regenerado: 81→84 paths, 8492→8772 líneas. Sin consumidores nuevos (próximo ciclo). **Único bloqueante backend restante:** `/api/management/config` (fallback ADR-0008 sigue aplicando, flags OFF en prod).
- **Audit K.4 del ciclo integración classify + credenciales** ([`docs/audits/credentials-classify-cycle-review.md`](./docs/audits/credentials-classify-cycle-review.md)) — 7 puntos K.4, 0 críticos, suite verde en `main` real (110 unit), 2 process slips documentados (#138 stacked base orfana → recovery #140; `--delete-branch` lesson revisitada).

> **Estado al cierre del ciclo (2026-05-21):** los 7 PRs del ciclo + #144 (abierto) cubren la integración real del flujo §17 + migración completa de credenciales SII al modelo Opción A + fix de login prod + types.ts regenerado con los 3 dominios desbloqueados por el backend. `main` verde. **Próximo ciclo** (necesita plan-before-issue + tu aprobación): wire Monedas (#87 addendum) · Reglas de clasificación CRUD (#88) · Industry templates apply (#89). Único pendiente backend: `/api/management/config` (no crítico — fallback ADR-0008 cubre).

#### Changed

- **Bundle budget `/admin/usuarios` reducido vía dynamic imports** ([#61](https://github.com/fperezd/qavante-web/pull/61), audit K.4 #2) — dialogs `Invite/Suspend/SiiPerson/CertUpload/DeleteConfirm` ahora son `next/dynamic` con `ssr: false`. **First Load JS gzip: 194 → 146 KB (-25%, -48 KB)** sobre `/admin/usuarios`. Sin impacto UX.
- **`docs/ARCHITECTURE.md` + `CONTRIBUTING.md`** ([#62](https://github.com/fperezd/qavante-web/pull/62)) — nueva sección "Dev environment + testing" con tabla de 7 capas de testing CI (unit/E2E HTTP/E2E mobile/type/lint/bundle/lighthouse/secrets). Actualiza endpoints mockeados (auth + users + SII). Documenta patrón anti-overflow para futuros mobile specs.
- **Bundle budget `/aceptar-invitacion` agregado a `size:check`** ([#66](https://github.com/fperezd/qavante-web/pull/66)) — la ruta pública de aceptación de invitación entra al gate CI con su propio budget. Cubre regresión potencial al agregar dependencias al flow de claim invitation.

#### Fixed

- **`config_missing` reachable en `apiErrorToUserMessage`** ([#72](https://github.com/fperezd/qavante-web/pull/72), [#70](https://github.com/fperezd/qavante-web/issues/70)) — `isNetworkError()` (status===0) ganaba al switch `err.code`, volviendo unreachable la rama `case "config_missing"`. Reordenado: switch sobre code antes que network. Un dev sin `NEXT_PUBLIC_API_URL` ahora ve el mensaje técnico "NEXT_PUBLIC_API_URL no configurada" en vez de "perdiste conexión".

### Pendiente cierre Sprint C0

- Tag de release `c0-complete-YYYY-MM-DD` desde `main` (manual de Fernando, último paso del Sprint).

### Pendiente cross-team (no bloquea cierre C0 en `qavante-web`)

- **qavante-api#58 + ADR-0003**: cookie de sesión cross-origin (`SameSite=None; Secure`) funcional → desbloquea `useSession`, login real end-to-end, Lighthouse para `/app/inicio` con seed de cookie.
- **qavante-api C0-14**: implementar `GET/POST /api/users`, `PATCH /api/users/{id}`, `POST /api/auth/accept-invitation` (contrato listo en frontend). Cuando bajen: regenerar `src/lib/api/types.ts` vía `npm run generate:api` y reemplazar tipos hand-rolled de `src/lib/api/users.ts`.
- **qavante-api C0-16**: RBAC dependency sobre endpoints existentes.
- **qavante-api C0-17**: RLS staging.
- **qavante-api C1 prep — DRIFT (2026-05-16)**: el backend **no** expuso los 6 endpoints `/api/credentials/sii` del contrato [`c1-sii-credentials.md`](./docs/backend-contracts/c1-sii-credentials.md); shipeó un modelo genérico `/api/admin/sources/{source_code}/credential|test|consent|sync-config`. **Decisión pendiente de Fernando** (reconciliation.md P4-2): FE se adapta a `admin/sources` vs. backend vuelve al contrato. Bloquea `generate:api` e ingesta sii_f29/previred de Sprint C1. Runbook: [`c1-sii-handoff-runbook.md`](./docs/backend-contracts/c1-sii-handoff-runbook.md).
- **qavante-api 2º handoff — taxonomía/gestión/multimoneda — MAYORMENTE DESTRABADO (2026-05-16)**: verificación dura del OpenAPI de prod (73 paths) confirma **LIVE** canonical-categories, management/accounts(+tree+move+toggles), dimensions(+values+assignments), bank-movements/classify, SII f29 ingesta. **Faltan 3 dominios**: industry-templates, currencies, classification-rules (+ `suggest-rule`, `/management/config`). Detalle en [`reconciliation.md`](./docs/addendum/reconciliation.md) P4. Trabajo FE sin más backend (feature-flags OFF, esqueletos, componentes presentacionales) habilitado; integración real de datos espera decisión drift SII + confirmación oficial del handoff.
- **`fly certs create api.qavante.com`** (Fernando — IaC manual).
- **Aceptar baseline Chromatic** (Fernando — UI web): aceptar una vez los diffs históricos en chromatic.com para limpiar el baseline. Falsos positivos por flakiness ya mitigados de raíz en [#88](https://github.com/fperezd/qavante-web/pull/88).

## [0.7.0] — 2026-05-13

### Milestone D — Admin mínima + cierre del Sprint C0 (parte FE)

Cierre del frontend de Administración + gate de performance automatizado + documentación de release. Cubre todo lo que `qavante-web` puede entregar para C0-15 y C0-18; los tickets cross-repo (C0-14/16/17) quedan a cargo de `qavante-api`.

#### Added

- **C0-15 — Frontend Administración → Usuarios** ([#44](https://github.com/fperezd/qavante-web/pull/44)) — tabla TanStack con cols nombre/email/rol (inline edit)/estado/último login (`date-fns` es-CL)/acciones. Modal "Invitar usuario" (`react-hook-form` + `zod`), suspender/reactivar con confirm, estado vacío con CTA, mapping de errores Anexo C.3 (`email_already_exists`, `invitation_already_pending`, `last_owner_protection`). Ruta pública `/aceptar-invitacion?token=xxx` con form de clave inicial. UI compila contra contrato `docs/backend-contracts/c0-auth-and-users.md § 3`; rinde error state hasta que `qavante-api` C0-14 esté arriba.
- **C0-15 — Sidebar gate** ([#48](https://github.com/fperezd/qavante-web/pull/48)) — módulo "Administración" oculto en sidebar para roles sin permiso (`visibleFor: ["owner", "admin", "technical_admin"]`, Anexo C.4). Cierra el último checkbox de DoD C0-15.
- **Lighthouse CI mobile en /login** ([#49](https://github.com/fperezd/qavante-web/pull/49) / issue #41) — job `lighthouse` en `.github/workflows/ci.yml`: `lhci autorun` con 3 runs sobre Pixel 4 emulation (412×823, dpr 1.75), slow 4G throttling (RTT 150ms, 1638.4 kbps), 4x CPU slowdown. Assert hard `performance ≥0.85` (Kit DoD sec 5.2), warn `accessibility/best-practices ≥0.9`. Upload de artifacts `.lighthouseci/` retención 7 días.
- **CHANGELOG.md inicial** ([#50](https://github.com/fperezd/qavante-web/pull/50) / issue #45) — Keep a Changelog 1.1.0 cubriendo historial completo desde C0-01 ([0.3.0] hasta este [0.7.0]).
- **README — Milestone D status** ([#50](https://github.com/fperezd/qavante-web/pull/50)) — Milestone D ⏳ → 🟡 → ✅ (este PR), link a CHANGELOG en sección Documentación.
- **Audit Anexo K.4 sobre Milestone D** ([docs/audits/c0-milestone-d-review.md](./docs/audits/c0-milestone-d-review.md) — este PR) — revisión integral end-to-end: 0 críticos, 1 medio, 2 menores. Suite verde (3 unit + 16 e2e + size:check + smoke), Lighthouse `/login` ≥85 en CI.

#### Changed

- **CONTRIBUTING.md** ([#49](https://github.com/fperezd/qavante-web/pull/49)) — checklist DoD por PR: línea de Lighthouse pasa de "verificar manual con devtools" a "automatizado en CI" para `/login`.
- **README — Milestone D 🟡 → ✅** (este PR) — todo lo que dependía de `qavante-web` está mergeado; quedan items manuales (demo, tag) + cross-team blockers documentados en `[Unreleased]`.

## [0.6.0] — 2026-05-13

### Milestone D parcial + anti-patching

Endurecimiento del repo previo al cierre del Sprint C0. Sin features nuevas — todo es infra, docs y guardrails.

#### Added

- **Bundle size budget en CI** ([#39](https://github.com/fperezd/qavante-web/pull/39)) — `scripts/check-bundle-size.mjs` corre en CI tras `next build` y revienta el job si `/login` o `/app/inicio` superan los budgets de Kit DoD sec 5.2.
- **Smoke test post-deploy** ([#29](https://github.com/fperezd/qavante-web/pull/29)) — `playwright.smoke.config.ts` + `tests/e2e/prod-health.smoke.spec.ts` corriendo contra `app.qavante.com` para validar deploys reales (no sólo build local).
- **ARCHITECTURE.md + CONTRIBUTING.md** ([#37](https://github.com/fperezd/qavante-web/pull/37)) — primer pase: diagrama Cloudflare Workers ↔ API Fly + convenciones de branching, conventional commits, PR template, DoD.
- **ADR-0004 — anti-patterns del Asistente Qavante** ([#35](https://github.com/fperezd/qavante-web/pull/35)) — registro preventivo de patrones a evitar en C2.
- **IaC ops versionado** ([#33](https://github.com/fperezd/qavante-web/pull/33)) — `docs/operations/cloudflare-dns.md` (registros DNS de `qavante.com`) + `docs/operations/github-secrets.md` (secrets versionados como inventario, no contenido).
- **Versionado de custom domain** ([#27](https://github.com/fperezd/qavante-web/pull/27)) — `wrangler.toml` declara `routes` para `app.qavante.com` (deploy declarativo, no clicks en UI).
- **Audit Anexo K.4 de Milestones A/B/C** ([#19](https://github.com/fperezd/qavante-web/pull/19)) — revisión integral previa a Milestone D documentada en `docs/audits/c0-milestone-abc-review.md`.

#### Changed

- **Documento Maestro v2.6.3 → v2.6.4** ([#23](https://github.com/fperezd/qavante-web/pull/23)) — dominio definitivo `qavante.com` (app en `app.qavante.com`) reemplaza `qavante.cl` del v2.6.3.
- **Kit + backend-contract + workflow alineados a `app.qavante.com`** ([#40](https://github.com/fperezd/qavante-web/pull/40)) — limpia las últimas referencias a hosts viejos.

#### Fixed

- **C0-02 alineado a Cloudflare Workers (no Pages)** ([#21](https://github.com/fperezd/qavante-web/pull/21)) — repo apuntaba a Pages en docs/config; consolidado a Workers via `@opennextjs/cloudflare` para coherencia con ADR-0001.
- **C0-13 middleware movido a `src/`** ([#20](https://github.com/fperezd/qavante-web/pull/20)) — `next.config` busca middleware en `src/` cuando `srcDir` está activo. Cobertura e2e (`tests/e2e/auth-redirect.spec.ts`) contra regresión.

## [0.5.0] — 2026-05-12

### Milestone C — Auth y conexión backend

Frontend listo para hablar con `qavante-api`. Endpoints reales del backend quedaron como dependencia cross-repo (C0-11, C0-14).

#### Added

- **API client tipado** ([#12](https://github.com/fperezd/qavante-web/pull/12), C0-10) — `src/lib/api/client.ts` contra FastAPI con interceptor 401 → redirect a `/login`. Types auto-generados desde OpenAPI (`npm run generate:api` → `src/lib/api/types.ts`).
- **Pantalla de login completa** ([#13](https://github.com/fperezd/qavante-web/pull/13), C0-12) — `/login` con form RUT + clave, validación zod, integración API client, mapping de errores Anexo C.3.
- **Middleware de protección de rutas** ([#14](https://github.com/fperezd/qavante-web/pull/14), C0-13) — `middleware.ts` redirige a `/login` si no hay cookie `qavante_session` en rutas `/app/*`. Cookies httpOnly únicamente (CLAUDE.md regla 6).
- **Contrato backend cross-repo** ([#18](https://github.com/fperezd/qavante-web/pull/18), C0-11+C0-14) — `docs/backend-contracts/c0-auth-and-users.md` con shapes esperados de `/api/auth/login`, `/api/auth/logout`, `/api/me`, `/api/users` (CRUD), `/api/auth/accept-invitation`. Acordado para coordinar el unblock con el equipo de backend.

## [0.4.0] — 2026-05-11

### Milestone B — Sistema de diseño y shell

Bases visuales y de navegación. Cero lógica de negocio.

#### Added

- **Sistema de Diseño Qavante — tokens** ([#8](https://github.com/fperezd/qavante-web/pull/8), C0-06) — Anexo B v2.6 mapeado a CSS vars (`src/styles/tokens.css`): color, type scale, radii, spacing, motion.
- **Componentes capa 1** ([#9](https://github.com/fperezd/qavante-web/pull/9), C0-07) — `QavanteButton`, `QavanteInput`, `QavanteCard`, `QavanteBadge`, `QavanteEmpty` sobre shadcn/ui + Base UI.
- **Layout shell global** ([#10](https://github.com/fperezd/qavante-web/pull/10), C0-08) — sidebar con 6 módulos + header con breadcrumb + responsive collapse mobile.
- **6 páginas placeholder con pregunta central** ([#11](https://github.com/fperezd/qavante-web/pull/11), C0-09) — `/app/inicio`, `/app/pulso`, `/app/cobranza`, `/app/proyecciones`, `/app/equipo`, `/app/administracion` rendereando `QavanteEmpty` con la pregunta del Anexo F.

## [0.3.0] — 2026-05-10

### Milestone A — Setup base + CI

Base del repo: Next.js 15 skeleton, Cloudflare Workers, CI mínima.

#### Added

- **Skeleton Next.js 15 + React 19 + TypeScript strict + Tailwind 4** ([#1](https://github.com/fperezd/qavante-web/pull/1), C0-01/C0-02).
- **Prettier + Husky + lint-staged + .editorconfig** ([#15](https://github.com/fperezd/qavante-web/pull/15), C0-04) — guardrails de formato pre-commit.
- **CI paralela con secrets-scan gitleaks** ([#17](https://github.com/fperezd/qavante-web/pull/17), C0-05) — jobs `lint`, `typecheck`, `test`, `build`, `e2e`, `secrets-scan` en `.github/workflows/ci.yml`.
- **README inicial + status C0-02 deploy** ([#4](https://github.com/fperezd/qavante-web/pull/4)).
- **CLAUDE.md alineado a `@opennextjs/cloudflare`** ([#5](https://github.com/fperezd/qavante-web/pull/5)) — regla 4: Workers vía adapter, no Pages.
- **Kit Sprint C0 v1.1 + PR template** ([#6](https://github.com/fperezd/qavante-web/pull/6)).
- **Documento Maestro v2.6.3** ([#7](https://github.com/fperezd/qavante-web/pull/7)) — primera versión alineada a Workers.

#### Fixed

- **CI roja desde el bootstrap** ([#16](https://github.com/fperezd/qavante-web/pull/16)) — puente a C0-05 mientras se resolvía la versión de Node + cache de `npm ci`.

[unreleased]: https://github.com/fperezd/qavante-web/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/fperezd/qavante-web/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/fperezd/qavante-web/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/fperezd/qavante-web/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/fperezd/qavante-web/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/fperezd/qavante-web/releases/tag/v0.3.0
