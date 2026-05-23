# ADR-0011: Patrón estándar de dialogs editores admin (Base UI + RHF + zod, lazy)

- **Status:** Accepted
- **Fecha:** 2026-05-23
- **Decididores:** Fernando + CC-WEB (rol CTO)
- **Tickets / PRs:** [#155](https://github.com/fperezd/qavante-web/pull/155) (Monedas), [#156](https://github.com/fperezd/qavante-web/pull/156) (Reglas), [#157](https://github.com/fperezd/qavante-web/pull/157) (Plantillas), [#158](https://github.com/fperezd/qavante-web/pull/158) (Banner §18.7), [#160](https://github.com/fperezd/qavante-web/pull/160) (Stories), [#163](https://github.com/fperezd/qavante-web/pull/163) (A11y)

## Contexto

Durante el ciclo del 2026-05-22 se introdujeron 4 dialogs editores admin
(`CurrencySettingsDialog`, `RuleFormDialog`, `ApplyTemplateDialog`,
`SuggestRuleBanner` con dialog adjunto). Cada uno se construyó replicando
el patrón ya establecido por `invite-user-dialog.tsx` (PR #80) y
`sii-credential-dialog.tsx` (PR #134), sin formalizarlo como decisión.

El ADR documenta ese patrón como **estándar** para los siguientes editores
admin del addendum (y de Fase 2 cuando llegue), de manera que futuros PRs
no tengan que re-decidir los mismos puntos.

## Decisión

**Todos los dialogs editores admin del frontend usan este stack y patrón:**

### Stack obligatorio

1. **Dialog primitive:** `@base-ui/react/dialog` (`Dialog.Root` + `Portal`
   - `Backdrop` + `Popup` + `Title` + `Description` + `Close`). El stub
     `src/components/ui/dialog.tsx` NO se usa.
2. **Form state:** `react-hook-form` con `Controller` para campos
   controlados (selects nativos, custom inputs).
3. **Validación:** `zod` schema + `@hookform/resolvers/zod` `zodResolver`.
4. **Estilo:** Tailwind 4 con tokens Qavante (`neutral-dark`,
   `brand-primary`, `danger-500`, etc.) — no clases custom fuera del DS.
5. **Botones:** `QavanteButton` del Capa 1; nada de `<button>` raw.

### Estructura de archivos

Para cada dominio nuevo:

```
src/components/{dominio}/
  ├── {dominio}-form-schema.ts        # zod schema + transforms PUROS (sin React)
  ├── {dominio}-form-schema.test.ts   # vitest unit — Node-puro, sin jsdom
  ├── {dominio}-form-dialog.tsx       # Dialog client component
  ├── {dominio}-form-dialog.stories.tsx  # Storybook stories con fixtures inline
  └── {dominio}-view.tsx              # contenedor que importa el dialog lazy
```

### Lazy load obligatorio

El dialog **debe importarse desde la view via `next/dynamic` con
`ssr: false`** para evitar que Base UI Dialog + RHF + zod entren al
First Load JS de la ruta:

```tsx
const FoobarDialog = dynamic(
  () => import("./foobar-dialog").then((m) => ({ default: m.FoobarDialog })),
  { ssr: false },
);
```

### Schema + transforms separados del dialog

El zod schema y las funciones `toForm()` / `formToRequest()` viven en un
archivo `.ts` puro (sin `"use client"`, sin imports de React). Esto
permite testearlos en el proyecto vitest `unit` (Node puro, sin jsdom),
alineado con el setup del repo (ver `vitest.config.ts`).

### Transform-en-el-dialog para datos parciales externos

Si el dialog acepta datos parciales de otra fuente (ej. una sugerencia
backend para pre-poblar el form), **el transform debe vivir adentro del
dialog**, no en el caller. Esto evita que el caller arrastre el schema +
zod a su chunk First Load.

> Lección concreta (PR-Sug #158): la primera versión tenía
> `<RuleFormDialog initialValues={suggestionToFormValues(suggestion)} />`
> en `por-clasificar-view`. Bundle subió +21 kB porque el caller importó
> el schema. Moviendo `suggestionToFormValues` al dialog (que ya es
> lazy), y exponiendo prop `suggestion?: SuggestRuleResponse | null`,
> bajó a +3 kB.

### A11y mínimo obligatorio

- **`aria-required="true"`** en todos los campos required del schema.
- **`aria-describedby`** apuntando al `id` del `<p role="alert">` con el
  error inline cuando hay error de validación.
- **Iconos decorativos**: `aria-hidden="true"`.
- **Errores inline**: `<p role="alert">` para que screen readers anuncien.
- **Submit error**: `<div role="alert">` para errores del servidor.
- **Labels**: cada input tiene `<label htmlFor>` asociado.

Base UI Dialog provee automáticamente: focus trap, `aria-modal`,
`aria-labelledby` (del `Dialog.Title`), `aria-describedby` (del
`Dialog.Description`), escape para cerrar, click-outside opcional.

### Gating de rol = NO en UI

El gating fino owner/admin lo hace el backend (403 → `apiErrorToUserMessage`,
Anexo C.3). La UI **siempre** muestra el botón "Editar/Crear/Aplicar".
Si el rol no tiene permiso, el dialog se abre, el user submitea, el
backend devuelve 403, y el mensaje del Anexo C.3 se renderiza inline.

Patrón ya establecido en `usuarios/page.tsx` (PR C0-15) — replicado
verbatim en Monedas/Reglas/Plantillas. El comentario explícito vive en
`src/app/(app)/administracion/usuarios/page.tsx:32`.

### Errores con `QavanteInlineError`

Para errores de queries (no de submit), usar el componente compartido
`QavanteInlineError` (`src/components/qavante/qavante-inline-error.tsx`,
extraído en PR #162). Reemplaza la función local `ErrorState` que estaba
duplicada en cada view.

## Alternativas consideradas

- **Opción A — shadcn Dialog (Radix UI) (descartada):** el stub
  `src/components/ui/dialog.tsx` sugiere que se evaluó pero no se cableó.
  Base UI ya está como dep desde PR temprano y resuelve los casos PYME.
  No se introduce Radix sin razón fuerte (ADR-0010 sobre disciplina
  de deps).
- **Opción B — `react-hook-form` sin zod (descartada):** RHF tiene
  validación nativa, pero zod ya está en el repo y permite **tests del
  schema sin renderizar UI** (Opción C abajo). Critical para mantener
  cobertura vitest unit sin jsdom.
- **Opción C — Schema + transforms separados (elegida):** mantener la
  lógica pura aparte del dialog permite testear toda la coherencia
  cliente-side en vitest unit (Node puro). Patrón replicable.
- **Opción D — Render inline en la view sin Dialog (descartada):**
  algunas pantallas (ej. editor inline expandible) podrían evitar
  Dialog, pero pierden la affordance modal estándar y obligan a
  scrollar. Dialog es claramente superior para formularios admin.
- **Opción E — Sin lazy load (descartada):** Base UI Dialog + RHF + zod
  combinados pesan ~30-40 kB. Sin lazy, cada vista subiría ese peso al
  First Load — afecta Lighthouse mobile. Lazy es obligatorio para
  preservar el budget del DoD.

## Consecuencias

### Positivas

- **Replicable**: futuros editores admin (Fase 2, P5-N) tienen el patrón
  ya documentado. No re-decidir cada vez.
- **Bundle controlado**: First Load JS de cada ruta admin queda casi
  plano vs handoff anterior; el peso del dialog vive en chunk lazy.
- **Tests robustos**: schema + transforms se testean sin renderizar UI,
  cobertura efectiva sin dependency de jsdom.
- **A11y por construcción**: el patrón establece el mínimo (aria-required,
  aria-describedby, role=alert, focus trap) — no se reinventa por
  PR.
- **Consistencia visual**: los 4 dialogs lucen idénticos (mismo Backdrop,
  Popup, Title, layout) — el user aprende uno y reconoce el resto.

### Negativas / tradeoffs aceptados

- **Boilerplate**: cada dialog repite ~80 líneas de `<Dialog.Root>` +
  `<Dialog.Portal>` + `<Dialog.Popup>` + `<Dialog.Title>` etc. Aceptable
  por la consistencia. Una extracción a `<QavanteFormDialog>` helper se
  evaluó pero se descartó: la flexibilidad de cada dialog (tamaño,
  scroll, layout) hace que el wrapper sea más restrictivo que útil. Si
  3+ dialogs futuros piden el mismo helper, revisamos.
- **No interactividad real en stories**: Storybook no usa MSW (decisión
  del repo, no de este ADR). Stories renderean el estado inicial; submit
  falla silenciosamente. Suficiente para baseline visual + Chromatic;
  interactividad full requeriría infra distinta (out of scope).

### Acciones que destraba o requiere

- [x] Aplicar el patrón a los 4 dialogs del ciclo 2026-05-22 (#155, #156,
      #157, #158).
- [x] Storybook stories siguiendo el patrón (#160).
- [x] A11y mínimo aplicado a los 4 dialogs (#163).
- [ ] Si se introduce un quinto editor admin (ej. editor de dimensiones,
      editor de cuentas de gestión), seguir este ADR sin discusión nueva.
- [ ] Si la decisión de toast notifications se toma (sonner está
      instalado pero el stub no se cableó), agregar al patrón cómo se
      integran toasts a los dialogs (probablemente en `onSuccess` del
      mutation).

## Referencias

- [PR #155 — Monedas editor (PR-MonEd)](https://github.com/fperezd/qavante-web/pull/155)
- [PR #156 — Reglas editor (PR-RulEd)](https://github.com/fperezd/qavante-web/pull/156)
- [PR #157 — Plantillas apply confirmatorio (PR-TplApp)](https://github.com/fperezd/qavante-web/pull/157)
- [PR #158 — Banner §18.7 sugerir-regla (PR-Sug)](https://github.com/fperezd/qavante-web/pull/158)
- [PR #160 — Storybook stories del ciclo](https://github.com/fperezd/qavante-web/pull/160)
- [PR #162 — QavanteInlineError compartido](https://github.com/fperezd/qavante-web/pull/162)
- [PR #163 — A11y aria-required + aria-describedby](https://github.com/fperezd/qavante-web/pull/163)
- [Audit K.4 del ciclo](../audits/editors-cycle-review.md)
- [ADR-0008 — Feature flags gating](./0008-feature-flags-gating-pantallas-sin-backend.md)
- [ADR-0010 — Selectores sin combobox library](./0010-selectores-sin-libreria-combobox.md)
