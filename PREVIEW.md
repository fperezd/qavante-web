# Preview local del addendum (flags ON + datos mock)

> **Rama:** `preview/addendum-flags-on` · **Solo visualización local. NO es
> deploy ni se mergea** (es `main` + un launcher de dev; lo real se mergea
> por sus PRs).

## Cómo verlo (sin backend ni login)

```bash
git fetch origin
git checkout preview/addendum-flags-on
npm install        # si hace falta (OneDrive: npm install, no npm ci)
npm run preview:addendum
# abrí http://localhost:3000
```

MSW (`NEXT_PUBLIC_API_MOCKING=enabled`) arranca un service worker que
**bypassa el login** y responde con fixtures — entrás directo a la app, sin
backend real.

## Qué vas a ver

| Pantalla                                                  | Estado en el preview                                                                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Administración → Estructura de gestión**                | ✅ **Cableada con datos mock** — árbol real (`useManagementAccountsTree`)                                                       |
| **Administración → Vistas de gestión**                    | ✅ **Cableada con datos mock** — lista de vistas (`useManagementDimensions`)                                                    |
| Administración → Usuarios / Credenciales SII              | Mock pre-existente (no es del addendum)                                                                                         |
| Monedas / Reglas de clasificación / Caja → Por clasificar | ⚠️ "Esta sección todavía no está disponible" — **la pantalla aún no se construyó** (flag ON pero sin UI; honesto, no es un bug) |

## Por qué en prod (`app.qavante.com`) NO se ven cableadas

Por **diseño** (ADR-0008): el override `NEXT_PUBLIC_FF_*` **se ignora en
builds de producción** (invariante de `feature-flags.ts`). En prod, sin
`/api/management/config`, los flags quedan **OFF** y las pantallas muestran
"no disponible". Este preview corre `next dev` (NODE_ENV=development), donde
el override SÍ se honra — por eso es local, no un preview desplegado.

## Importante

- Es `main` + `scripts/preview-addendum.mjs` (launcher dev) + este doc. No
  cambia código de app. No mergear esta rama; lo cableado ya está en `main`
  por #122/#126, lo que sigue va por sus propios PRs.
- Los datos son **fixtures de MSW** (`src/test/msw/handlers.ts`), no backend
  real. Sirven para revisar UX/UI, no datos reales.
