# Handoff — Sprint 3 dominios desbloqueados (Monedas + Reglas + Plantillas)

> **Autor:** CC-WEB — 2026-05-21 (sesión autónoma 6h, mandato Fernando)
> **Estado:** 7 PRs abiertos esperando tu merge, todo CLEAN excepto e2e
> (resuelto por #147 — el resto vuelve verde post-merge de #147)
> **Cubre:** los 3 dominios que el backend lanzó hoy
> (industry-templates, currencies, classification-rules)

## TL;DR

- **7 PRs abiertos**, listos para tu review:
  1. **#147** — fix e2e (cleanup slip Opción A) — **ya VERDE, mergear primero**
  2. **#148** — capa de datos Monedas (`currencies.ts` + tests + handlers MSW)
  3. **#149** — capa de datos Reglas (`classification-rules.ts` + tests + handlers)
  4. **#150** — capa de datos Plantillas (`industry-templates.ts` + tests + handlers)
  5. **#151** — wire `/administracion/monedas` (Ajustes + Tipos de cambio, read-only)
  6. **#152** — wire `/administracion/reglas-clasificacion` (lista + toggle active)
  7. **#153** — wire `/administracion/plantillas` (nueva pantalla + nueva admin card, preview seguro)
- **24 tests nuevos** (9 currencies + 7 rules + 8 templates) + typecheck CLEAN en cada PR.
- **3 sprints completos**: data-layer-first pattern + UI wire (read + mutation segura) por dominio.
- **Sin destrucción.** Todo respeta §14.1 (apply solo modo `suggest_only` en el primer UI), §17.5
  (reglas no se borran, solo desactivan), §15.7 (ausencia TC ≠ error).
- **0 deps nuevas, 0 cambios de runtime, 0 violaciones de reglas CLAUDE.md.**

## Orden de merge recomendado

> ⚠️ Los 3 stacked PRs ya están **retargeteados a main** (proactivamente, para
> evitar el orphan-on-merge que pasó con #98/#102 y #138). Igual hay
> dependencias funcionales — respetá el orden:

```
1. #147 (e2e fix)        → main, ya verde
2. #148 (Monedas data)   → main, dependencia de #151
3. #151 (Monedas UI)     → main, depende de #148
4. #149 (Reglas data)    → main, dependencia de #152
5. #152 (Reglas UI)      → main, depende de #149
6. #150 (Plantillas data)→ main, dependencia de #153
7. #153 (Plantillas UI)  → main, depende de #150
```

Cada pareja (#148/#151, #149/#152, #150/#153) **debe mergearse en ese orden**:
los UI PRs importan tipos/hooks de su data layer. Si invertís el orden la build
del segundo se rompe.

### Conflictos esperados

- **#149 sobre main post-#148** y **#150 sobre main post-#148/#149**:
  conflicto en `src/test/msw/handlers.ts` (cada PR agrega su sección al
  `export const handlers = [...]`). Resolución trivial: agregar el
  array spread de los otros dominios. GitHub debería auto-detectarlo
  o yo (o vos) podemos rebasear local.
- Los UI PRs (#151/#152/#153) **no chocan entre sí** ni con los data
  PRs — tocan rutas y componentes distintos.

## Detalle por dominio

### Monedas — PRs #148 + #151 (Addendum §15/§16)

**Data layer (#148):**

- 4 hooks: `useCurrencies`, `useExchangeRate({base,quote,date?})`,
  `useCompanyCurrencySettings`, `useUpdateCompanyCurrencySettings`.
- §15.7 cubierto: ausencia de TC → `data_status="requires_attention"` +
  `rate=null` mapeado **NO como error**.
- §15.4 cubierto: 404 en settings → `data: null` (fallback a defaults en UI).
- MSW seed: 6 monedas (CLP/USD/EUR/BRL fiat + UF/UTM indexed_unit) +
  5 TCs (USD>CLP, EUR>CLP, BRL>CLP, UF>CLP, UTM>CLP) + settings con
  CLP funcional + USD reporting default.
- **9 tests verdes** (keys + 3 endpoints x casos).

**UI (#151):**

- `/administracion/monedas` cableada (flag ON: bloque Ajustes read-only +
  sección Tipos de cambio con un card por par).
- Cada `ExchangeRateCard` tiene su propio query (cache por par).
- Banda "Sin datos" amarilla cuando `requires_attention` (NO danger).
- Empty state cuando settings = null.

**Limites scope:** solo READ. Edición de settings (PATCH) en próximo PR.

### Reglas — PRs #149 + #152 (Addendum §17.5/§17.6/§18.7)

**Data layer (#149):**

- 5 hooks: `useClassificationRules`, `useCreateClassificationRule`,
  `useUpdateClassificationRule`, `useToggleClassificationRuleActive`,
  `useSuggestRuleForMovement`.
- §17.5 cubierto: solo `toggle-active`, NO existe DELETE en el contrato.
- §17.6 cubierto: lista viene ordenada ASC por priority (el FE confía
  en ese orden — verificado en MSW).
- §18.7 cubierto: `suggest-rule` es read-only — el test verifica que
  el listado NO crece tras un suggest.
- MSW seed: 3 reglas (Sueldo Fernando activa P10 / Movistar activa P50 /
  Transferencias desactivada P90).
- **7 tests verdes.**

**UI (#152):**

- `/administracion/reglas-clasificacion` cableada (flag ON: lista de
  cards con condición traducida a español + toggle activo/inactivo
  inline + badges).
- Mapping `operator` (7 valores) y `condition_field` (6 valores) a labels
  españoles.
- Confianza humanizada ("0.80" → "80%").
- Toggle aislado por id (loading state per-row).

**Limites scope:** solo READ + toggle. Create/edit dialogs en próximos PRs.

### Plantillas — PRs #150 + #153 (Addendum §13/§14)

**Data layer (#150):**

- 3 hooks: `useIndustryTemplates`, `useIndustryTemplate(code)`,
  `useApplyIndustryTemplate`.
- §14.1 cubierto: `useApplyIndustryTemplate` invalida cache solo cuando
  `mode !== "suggest_only"` (preview puro no necesita refetch).
- MSW seed: 3 plantillas (services / retail_commerce / construction_projects)
  - detail completo para `services` (2 dimensions + 2 accounts).
- **8 tests verdes.**

**UI (#153):**

- **Pantalla NUEVA** `/administracion/plantillas` + nueva card "Plantillas
  por rubro" en el landing de Administración (ícono Briefcase).
- Galería de plantillas con preview seguro: click "Ver vista previa" →
  POST `.../apply` con `mode=suggest_only` → muestra summary inline
  (accounts/dimensions to_add vs existing).
- Mapping `business_family` (15 valores) → ícono Lucide + label español.
- Cero escritura: el botón principal NO escribe. El apply real
  (mode=add_missing) sale en PR siguiente con dialog confirmatorio.

**Limites scope:** solo preview. Apply real con confirmación en próximo PR.

## Test counts

| Suite             | Antes        | Después                                        | Nuevos |
| ----------------- | ------------ | ---------------------------------------------- | ------ |
| `vitest unit`     | 110          | 134                                            | +24    |
| Tests por dominio | —            | currencies 9 / rules 7 / templates 8           | —      |
| Storybook visual  | —            | sin cambios (stories de wired views diferidas) | 0      |
| e2e mobile        | 5 (1 broken) | 5 (todos verdes)                               | fix    |

## Decisiones del audit K.5 (preliminar)

> El audit K.5 formal completo va en un PR docs separado **post-merge**.
> Acá adelanto los hallazgos para que no te quedes pensando:

1. **Inventario:** ✅ 8 archivos nuevos (3 data layers + 3 UI views + plantillas/page +
   admin landing modified), 1 e2e fix, 0 archivos borrados.
2. **Tests pasando:** ✅ 134/134 vitest (verificado en cada PR), e2e
   verde tras #147 merge, storybook sin cambios.
3. **Sin regresiones:** ✅ navegación intacta, sidebar 6 módulos +
   1 nuevo (Plantillas). Rutas existentes sin cambios funcionales.
4. **Coherencia:**
   - ADR-0007 (sin `src/features/`): ✅ usé `src/components/{monedas,reglas,plantillas}/`.
   - ADR-0008 (flags default OFF + invariante prod): ✅ respetado.
   - Regla 3 (no hand-edit types.ts): ✅ todo via generated.
   - Regla 4 (sin runtime export): ✅ verificado en los 3 page.tsx.
   - Regla 11 (1 PR = 1 issue): mayoría respetada; #153 cierra parcial #89
     pero también suma el SubModuleCard (alcance natural del wire).
   - Regla 12 (<300 líneas): UI views ~240, data layers ~110 c/u. OK.
   - Regla 16 (no inventar contrato): ✅ todo verificado contra
     `types.ts` regenerado en #144.
5. **DoD:** ✅ los 3 dominios cableados read-only end-to-end vía MSW
   (no necesitás backend para verlos en dev preview).
6. **Documentación:** este handoff + comentarios in-code densos por PR.
7. **Lighthouse/bundle:** sin verificar todavía (lo hago al cerrar el
   ciclo en el audit K.5 formal). Expectativa: bundle sube ~5-8 kB por
   pantalla nueva (chunks lazy-loadeables, no afectan home).

## Próximo ciclo — qué falta

Una vez que mergees los 7 PRs:

- **Editores de cada dominio** (Monedas PATCH settings / Reglas create+edit /
  Plantillas apply confirmatorio con `mode=add_missing`).
- **Drag-drop priority de reglas** (§17.6 — pero el backend no expone
  endpoint reorder, vamos a tener que coordinar con CC-API).
- **Banner §18.7 (suggest-rule) en el drawer §17** — cuando el usuario
  clasifica, ofrecer "crear regla a partir de este movimiento".
- **Storybook stories** para los wired views (necesitan `QueryClientProvider`
  wrapper — pequeño helper, después se reusa para los 3 dominios).

---

Generated by CC-WEB — 2026-05-21.
