# Code-review #3 (forms/mutations/effects) — hallazgos para revisión humana

> 3ª pasada del code-review multi-agente (forms, mutations, effects/hooks, selects,
> tablas). **12 hallazgos confirmados.** 5 arreglados en [PR #249](https://github.com/fperezd/qavante-web/pull/249)
> (error handling de borrado, invalidación de cache, guards `$NaN`/fecha).
>
> Los **7 de abajo se DIFIRIERON** (tocan role-management/auth, son nuance, o
> están detrás de flags OFF). **Acción: Fernando revisa.** El #10 es **HIGH** y
> conviene priorizarlo.

> ## ✅ RESUELTOS (2026-06-01) — los 7 diferidos, mergeados a `main`
>
> Fernando autorizó arreglarlos. **Todos cerrados:**
>
> | # | Sev | PR |
> |---|-----|----|
> | #10 | HIGH | [#252](https://github.com/fperezd/qavante-web/pull/252) — role-`select` no asignable → texto read-only |
> | #4 | MED | [#258](https://github.com/fperezd/qavante-web/pull/258) — error de clasificación dentro del drawer + `classify.reset()` |
> | #7 | MED | [#259](https://github.com/fperezd/qavante-web/pull/259) — `currency-code-select` `<option hidden disabled>` para value huérfano |
> | #8 | MED | [#263](https://github.com/fperezd/qavante-web/pull/263) — `qavante-input` reancla el caret (currency/rut) — toca login, sin cambio funcional |
> | #5 | low | [#262](https://github.com/fperezd/qavante-web/pull/262) — limpia el default de reporte stale |
> | #9 | low | [#260](https://github.com/fperezd/qavante-web/pull/260) — `dimension-value-picker` "Sin asignar" |
> | #12 | low | [#261](https://github.com/fperezd/qavante-web/pull/261) — `cash-flow-table` `normalizeNet` (no `$-0`) |
>
> Las secciones de abajo quedan como registro del diagnóstico original.

## 🔴 #10 (HIGH) — `users-table.tsx`: el `<select>` de rol miente y puede degradar un owner en silencio

- **Archivo:** [`src/components/administracion/users-table.tsx:47-71`](../../src/components/administracion/users-table.tsx#L47) · severidad **high** · confidence **high** · **toca role-management**
- **Qué:** el `<select>` de rol es controlado (`value={u.role}`) pero las `<option>` filtran `owner` (salvo `currentUserRole === "owner"`) y **nunca incluyen `technical_admin`**. La página de prod renderiza `<UsersTable>` **sin pasar `currentUserRole`** (`administracion/usuarios/page.tsx:79`), así que `owner` queda **siempre** filtrado. Cuando se edita la celda de rol de un usuario `owner` o `technical_admin`, el `value` controlado no tiene `<option>` que lo matchee → el browser muestra la **primera** opción (ej. "Administrador"), o sea el select **miente** sobre el rol actual; si el admin elige algo, **degrada al owner sin verlo**.
- **Fix sugerido:** incluir siempre una `<option value={u.role}>` (ideal `disabled`) cuando `u.role` no esté en la lista filtrada — `Array.from(new Set([u.role, ...filtradas]))` — o renderizar las filas de `owner`/`technical_admin` como **texto read-only** en vez de select cuando el usuario actual no puede cambiarlas.
- **Por qué lo DIFIERO:** toca el flujo de cambio de rol (RBAC) → tu revisión. Riesgo del fix bajo, pero la implicancia (degradar un owner) amerita ojo humano. **Nota:** mitigado hoy si `/administracion/usuarios` no carga usuarios reales en prod (depende de que `/api/users` acepte cookie — Brecha 0 residual).

## ⚖️ #4 (MED) — `por-clasificar-view.tsx`: el error de clasificación queda invisible detrás del drawer

- **Archivo:** [`src/components/clasificacion/por-clasificar-view.tsx:201-203`](../../src/components/clasificacion/por-clasificar-view.tsx#L201) · no-auth · **pantalla LIVE**
- **Qué:** el `ClassificationDrawer` es overlay `fixed inset-0 z-50`. Cuando `classify` falla, el `QavanteInlineError` se renderiza en el flujo de la página, **debajo del overlay** → invisible. El drawer queda abierto sin explicación. Además, al cambiar de movimiento no se hace `classify.reset()`, así que un error previo persiste stale.
- **Fix sugerido:** renderizar el error **dentro** del drawer (pasar `submitError` con `role="alert"` arriba del footer) + `classify.reset()` al cambiar de movimiento. **Por qué lo difiero:** requiere threading de un prop a `ClassificationDrawer` (cambio cuidadoso en pantalla live). **Es un bug real de UX en prod** (clasificación falla en silencio) — vale arreglarlo pronto.

## ⚖️ #7 (MED) — `currency-code-select.tsx`: select controlado diverge cuando `value` no está en las opciones

- **Archivo:** [`src/components/monedas/currency-code-select.tsx:52-78`](../../src/components/monedas/currency-code-select.tsx#L52) · no-auth · **flag `multiCurrency` OFF**
- **Qué:** mismo patrón que #10 pero en monedas: si la moneda funcional persistida quedó `active=false` o fuera del `filterType`, no hay `<option>` que la matchee → el select muestra otra moneda y persiste la vieja al submit. Mitigado: backend revalida (422) + la pantalla está detrás de flag OFF.
- **Fix sugerido:** renderizar una `<option value={value} hidden disabled>` cuando `value` no esté en `options`, o normalizar a `""` notificando via `onChange`.

## Otros diferidos (low)

- **#5** `currency-settings-dialog.tsx:186-205` — al quitar una moneda de reporte, la "moneda por defecto" queda con valor stale invisible en el select (lo atrapa el submit con un refine; flag OFF). Fix: efecto que limpie el default cuando sale de `reportingCodes`.
- **#8** `qavante-input.tsx:50-66` — `variant=currency/rut` reformatea en cada tecla sin restaurar el caret → el cursor salta al final al editar en medio (afecta el RUT de login). Fix: restaurar `selectionStart` en un layout effect, o formatear solo en `onBlur`. (Riesgo med + toca el input de login → tu revisión.)
- **#9** `dimension-value-picker.tsx:35-41` — en modo single (radios) no se puede deseleccionar (la rama toggle-off es código muerto: un radio ya `checked` no dispara `onChange`). Fix: opción explícita "Sin asignar" o mover a `onClick`.
- **#12** `cash-flow-table.tsx:84-118` — un neto que redondea a `-0` muestra `"$-0"` + color incoherente (rojo en un cero). Cosmético, solo si el backend manda CLP fraccionario. Fix: normalizar `Math.round(net) || 0` antes de formatear y de decidir color.

---

_Reportado por CC-WEB, 2026-05-31. Los 5 fixes autónomos del review #3 están en `main` (#249)._
