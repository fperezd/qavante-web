# Revisión integral C0 — Milestones A/B/C (Anexo K.4)

**Fecha:** 2026-05-12
**Alcance:** todo lo mergeado en `main` entre el commit inicial `50923d2` y `8cfe97a` (C0-05). Cubre 18 commits, 88 archivos, +26 048 LoC.
**Ejecutor:** CC-WEB.
**Resultado global:** **2 hallazgos críticos + 3 medios + 5 menores.** El sprint no está listo para declararse completado sin remediar al menos los críticos.

---

## TL;DR

| #   | Hallazgo                                                                                                                                     | Severidad  | Origen                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------- |
| 1   | `middleware.ts` en root NO se ejecuta porque el proyecto usa `src/`. Toda ruta protegida (`/inicio`, `/caja`, etc.) carga sin autenticación. | 🔴 crítico | C0-13                      |
| 2   | Backend `qavante-api` no tiene auth (`/api/auth/*`, `/api/me`) ni User CRUD. Frontend mergeado con placeholders explícitos.                  | 🔴 crítico | C0-11/C0-14 (cross-repo)   |
| 3   | Lighthouse mobile `/login` Performance = 79 (DoD ≥ 85).                                                                                      | 🟡 medio   | C0-12                      |
| 4   | 0 archivos de test en todo el repo (vitest + Playwright). DoDs declarados sin tests cubriendo.                                               | 🟡 medio   | C0-09, C0-10, C0-12, C0-13 |
| 5   | README.md desactualizado — declara "C0-01 completado / C0-02 en progreso" cuando ya cerraron Milestones A/B/C parciales.                     | 🟡 medio   | docs                       |
| 6   | README dice "Cloudflare Pages" pero el target real es Cloudflare Workers (vía `@opennextjs/cloudflare`).                                     | 🟢 menor   | docs (post-PR #7)          |
| 7   | `tailwind.config.ts` no existe — Tailwind 4 lo reemplaza con `@theme` en `globals.css`. El DoD de C0-06 mencionaba ese archivo.              | 🟢 menor   | C0-06                      |
| 8   | `tests/unit/` y `tests/e2e/` son carpetas vacías no rastreadas en git.                                                                       | 🟢 menor   | bootstrap                  |
| 9   | No hay `CHANGELOG.md`. Difiere a C0-18 pero ya hay 5 features+ que justificaría arrancarlo.                                                  | 🟢 menor   | C0-18 (pendiente)          |
| 10  | C0-02-CLOUDFLARE-SETUP.md está en raíz del repo y mezcla docs operativos con código.                                                         | 🟢 menor   | C0-02                      |

Detalle por check abajo.

---

## #1 — Inventario

`git diff --stat 50923d2..HEAD`:

- 88 files changed, **+26 048 / −2** LoC
- 87 archivos nuevos, 1 modificado (README.md), 0 eliminados

Breakdown por área:

| Área                                            | Archivos                                                                                                                                                                                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Config/infra                                    | 14 (`.editorconfig`, `.github/*`, `.husky/pre-commit`, `.nvmrc`, `.prettier*`, `eslint.config.mjs`, `next.config.ts`, `open-next.config.ts`, `package*.json`, `postcss.config.mjs`, `tsconfig.json`, `wrangler.toml`, `components.json`) |
| Docs                                            | 4 (CLAUDE.md, QAVANTE_SPRINT_C0_KIT.md, C0-02-CLOUDFLARE-SETUP.md, qavante_fase1_v2.6.3.docx)                                                                                                                                            |
| App routes (`src/app/`)                         | 16 archivos en route groups `(app)/` y `(auth)/` + raíz + playground + error/not-found                                                                                                                                                   |
| Components Qavante                              | 8 (`qavante-*` + index + assistant/trigger)                                                                                                                                                                                              |
| Components shadcn/ui                            | 9 (`ui/{badge,button,card,command,dialog,form,input,sonner,tabs}`)                                                                                                                                                                       |
| Shell                                           | 4 (`shell/{app-shell,breadcrumbs,header,sidebar}`)                                                                                                                                                                                       |
| Lib (api/auth/formatters/i18n/utils/validators) | 15                                                                                                                                                                                                                                       |
| Public assets                                   | 5 SVG                                                                                                                                                                                                                                    |
| Middleware (root)                               | 1 (`middleware.ts`) ← **problema, ver #1 abajo**                                                                                                                                                                                         |

---

## #2 — Tests

```
> npm run test
RUN  v4.1.5
No test files found, exiting with code 0
```

- **vitest unit**: 0 archivos. `tests/unit/` carpeta vacía no rastreada por git.
- **Playwright e2e**: instalado (`@playwright/test@1.59.1`) pero sin `playwright.config.*`, sin tests, `tests/e2e/` vacía.
- El job `test` del CI pasa por `--passWithNoTests` agregado en PR #16 — sólo verifica que la suite no crashee, no que cubra nada.

**DoD de C0-09 menciona "Tests E2E básicos: navegar de una a otra desde el sidebar".** No están escritos.

**Recomendación**: aceptar como deuda explícita para C0-18 (o un mini-ticket entre medio). El test minimum viable es un Playwright spec navegando los 6 placeholders y verificando `<h1>` con la pregunta central.

---

## #3 — Sin regresiones (smoke navegación)

Dev server local (`npm run dev`) sobre puerto 3008, sin cookie de sesión:

| Ruta                       | HTTP    | Esperado                     |
| -------------------------- | ------- | ---------------------------- |
| `/`                        | 200     | ✓                            |
| `/login`                   | 200     | ✓                            |
| `/recuperar-clave`         | 200     | ✓                            |
| `/playground`              | 200     | ✓                            |
| `/inicio`                  | **200** | debería ser **307 → /login** |
| `/caja`                    | **200** | debería ser **307 → /login** |
| `/cobrar`                  | **200** | debería ser **307 → /login** |
| `/pagar`                   | **200** | debería ser **307 → /login** |
| `/gestion`                 | **200** | debería ser **307 → /login** |
| `/administracion`          | **200** | debería ser **307 → /login** |
| `/administracion/usuarios` | **200** | debería ser **307 → /login** |
| `/ruta-inexistente`        | 404     | ✓                            |

**🔴 HALLAZGO CRÍTICO #1:** El middleware no se ejecuta. Causa raíz:

- El proyecto usa estructura `src/` (`src/app`, `src/components`, etc.).
- Cuando hay `src/`, Next.js requiere que el middleware esté en **`src/middleware.ts`**. El archivo actualmente está en **raíz del proyecto** ([middleware.ts](../../middleware.ts)).
- Next.js **no emite warning** — simplemente ignora el archivo silenciosamente.
- Resultado: el matcher `["/inicio/:path*", "/caja/:path*", ...]` nunca se evalúa y todas las rutas protegidas son accesibles sin auth.

DoD de C0-13 declaró "Acceder a `/app/inicio` sin login redirige a `/login?redirect=/app/inicio`" → **NO se cumple**.

**Fix de 1 línea:** `git mv middleware.ts src/middleware.ts`. Confirmé que [middleware.ts](../../middleware.ts) usa import path `@/lib/auth/cookies` que sigue siendo válido desde `src/`.

---

## #4 — Coherencia

| Check                                            | Resultado                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------ |
| `npm run typecheck`                              | ✓ pass                                                                         |
| `npm run lint`                                   | ✓ pass                                                                         |
| `npm run build`                                  | ✓ pass (15 rutas estáticas)                                                    |
| `src/lib/api/types.ts` marcado auto-generated    | ✓ header presente                                                              |
| `types.ts` driftea vs `/openapi.json` prod       | ✗ sin drift (regenerado contra `tooxs-gestion-api.fly.dev` y `git diff` vacío) |
| `export const runtime = 'edge'` en algún archivo | ✓ ninguno (cumple CLAUDE.md regla 4)                                           |
| `any` en `src/components` o `src/lib`            | ✓ ninguno (cumple regla 7)                                                     |
| `localStorage` / `sessionStorage` para tokens    | ✓ no se usan (cumple regla 6)                                                  |
| Imports de `src/`                                | ✓ 56 archivos TS, grafo limpio                                                 |
| `AppProviders` (React Query) envuelve `<html>`   | ✓ `src/app/layout.tsx:25`                                                      |
| Inter font (`next/font/google`) sin FOUT         | ✓ wired en layout (DoD C0-06)                                                  |

---

## #5 — DoD por ticket

| Ticket | DoD                                             | Estado                                                                                                                               |
| ------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| C0-01  | `dev`/`build`/`typecheck` corren                | ✓                                                                                                                                    |
| C0-01  | README claro                                    | ⚠ desactualizado (ver #6)                                                                                                            |
| C0-02  | `qavante.cl` carga la app                       | _no verificable desde este repo_                                                                                                     |
| C0-02  | HTTPS válido + deploy automático                | _idem_                                                                                                                               |
| C0-02  | `build:cloudflare` local pasa                   | ✓ script presente, no ejecutado en este audit                                                                                        |
| C0-03  | Libs instaladas sin warnings                    | ✓                                                                                                                                    |
| C0-03  | QueryClient provider                            | ✓                                                                                                                                    |
| C0-04  | Pre-commit hook bloquea errores                 | ✓ verificado (husky disparó en commits recientes)                                                                                    |
| C0-05  | 5 jobs CI separados                             | ✓ (PR #17)                                                                                                                           |
| C0-05  | Status checks obligatorios en branch protection | ⚠ acción manual del owner en GitHub Settings (no se puede automatizar desde repo)                                                    |
| C0-06  | `/playground` muestra colores + tamaños         | ✓ (334 líneas)                                                                                                                       |
| C0-06  | `tailwind.config.ts` extendido                  | ✗ archivo no existe — Tailwind 4 usa `@theme` en `globals.css`. **Deliverable del Kit obsoleto** por la versión de Tailwind elegida. |
| C0-07  | Cada componente sin `any`                       | ✓                                                                                                                                    |
| C0-07  | JSDoc en componentes                            | _no auditado en detalle_                                                                                                             |
| C0-07  | `/playground` muestra todos los componentes     | ✓                                                                                                                                    |
| C0-08  | Sidebar destaca módulo activo                   | ✓ código `usePathname()` presente                                                                                                    |
| C0-08  | Botón flotante visible                          | ✓ `src/components/assistant/trigger.tsx`                                                                                             |
| C0-08  | Mobile responsive (hamburguesa)                 | _no auditado en browser real_                                                                                                        |
| C0-08  | Lighthouse mobile ≥85 en /inicio                | ✓ score = **94** (ver #7)                                                                                                            |
| C0-09  | 6 rutas cargan sin error                        | ✓                                                                                                                                    |
| C0-09  | Cada una con pregunta central                   | ✓ ej. /inicio → "¿Cómo está mi empresa hoy?"                                                                                         |
| C0-09  | Tests E2E navegación                            | ✗ no escritos (ver #2)                                                                                                               |
| C0-10  | `generate:api` corre                            | ✓                                                                                                                                    |
| C0-10  | Llamada `/health-lite` retorna OK               | ✓ (Playground page consume)                                                                                                          |
| C0-10  | 401 dispara refresh                             | ✓ código presente, no probado end-to-end                                                                                             |
| C0-12  | Login con credenciales correctas redirige       | ✗ **bloqueado por #2 (backend no existe)**                                                                                           |
| C0-12  | Rate limit 10 intentos muestra mensaje          | ✗ idem                                                                                                                               |
| C0-13  | Acceder a `/inicio` sin login redirige          | 🔴 **NO se cumple — middleware no se ejecuta (#1)**                                                                                  |
| C0-13  | `auth()` server-side retorna sesión             | ⚠ retorna placeholder fijo (`role: "owner"`) hasta C0-11. Documentado en [session.ts:9-12](../../src/lib/auth/session.ts#L9-L12).    |

---

## #6 — Documentación

- **README.md** (70 líneas): existe, tiene secciones útiles. Problemas:
  - Estado declarado: "✅ C0-01 completado | 🚀 C0-02 en progreso (manual Cloudflare setup)". Realidad: C0-01..C0-13 mergeados, C0-04/05 también. **Desactualizado por ≈10 tickets.**
  - Texto dice "Cloudflare Pages" en encabezado; CLAUDE.md regla 4 (corregida en PR #5) aclara que el target es Cloudflare Workers vía `@opennextjs/cloudflare`. README no se actualizó.
- **CLAUDE.md**: 151 líneas, vigente y alineado con doc maestro v2.6.3.
- **CHANGELOG.md**: no existe. Deliverable de C0-18.
- **Comentarios inline**: razonables. Notable:
  - [session.ts:9-12](../../src/lib/auth/session.ts#L9-L12) y [cookies.ts:1-4](../../src/lib/auth/cookies.ts#L1-L4): comentarios explican honesty placeholders esperando C0-11 backend. Buena práctica.
  - [middleware.ts:5-12](../../middleware.ts#L5-L12): describe la lógica del matcher. Útil pero **el archivo entero no se ejecuta** (#1).
- **C0-02-CLOUDFLARE-SETUP.md** en raíz: documento operativo de bootstrap (53 líneas). Conviene moverlo a `docs/` para no contaminar la raíz del repo, o eliminarlo si su contenido ya migró al README/CLAUDE.

---

## #7 — Lighthouse mobile (production build)

`npm run build && PORT=3009 npm start` sobre Chrome headless, mobile form factor, sin throttling adicional:

| Ruta      | Perf   | A11y | Best Pr. | SEO | DoD perf    |
| --------- | ------ | ---- | -------- | --- | ----------- |
| `/login`  | **79** | 94   | 100      | 100 | ≥ **85** ❌ |
| `/inicio` | **94** | 93   | 100      | 100 | ≥ **90** ✓  |

- `/inicio` cumple todos los DoD (placeholder simple).
- `/login` queda 6 puntos por debajo del threshold de C0-12. Top opportunity reportada por Lighthouse: `server-response-time` (~25ms — irrelevante, el bottleneck real es bundle size).
- Build report ya mostraba que `/login` es la página más pesada: **31.7 kB First Load JS** (vs 2.5 kB del resto). El peso viene de `react-hook-form` + `zod` + `@hookform/resolvers` + componentes de Qavante.
- **Recomendación**: lazy-load del schema Zod, o dynamic import del formulario para que el bundle inicial sólo cargue el branding. Margin es chico (79 → 85) y no requiere refactor estructural.

---

## Recomendaciones por severidad

### 🔴 Crítico — bloquea cierre de Sprint C0

1. **Fix middleware** — `git mv middleware.ts src/middleware.ts`. Re-correr smoke y confirmar que `/inicio` ahora redirige 307 a `/login?redirect=/inicio`. Cubrir con un Playwright e2e que prueba este comportamiento exactamente (preempting #4 con un test mínimo de valor).
2. **Coordinar backend** (PR #18 ya documenta los 9 endpoints requeridos). El frontend ya tiene placeholders honestos; bloquea cierre y bloquea C0-15 / C0-18.

### 🟡 Medio — antes de declarar Milestone B/C completo

3. **Perf `/login`** — dynamic import del form. Si el OneShot es alto, dejarlo como C0-12.1 (mini-ticket) y documentar deuda.
4. **Tests** — al menos un Playwright spec por shell-navigation (cubre C0-09 DoD).
5. **README actualizado** — barrer el "estado", aclarar Workers vs Pages, mencionar comando `generate:api`, link al Documento Maestro v2.6.3.

### 🟢 Menor — limpieza para C0-18

6. **`tailwind.config.ts`** — actualizar el Kit (no este repo) para reflejar que Tailwind 4 lo reemplaza. Es deuda del documento, no del código.
7. **`tests/`** — agregar `tests/unit/.gitkeep` + `tests/e2e/.gitkeep` o eliminar las carpetas si no se van a usar.
8. **CHANGELOG.md** — arrancar con bullets retroactivos de Milestones A/B/C parciales.
9. **`C0-02-CLOUDFLARE-SETUP.md`** — mover a `docs/operations/cloudflare-setup.md` o eliminar si está obsoleto.

---

## Apéndice — comandos para reproducir el audit

```bash
# Inventario
git diff --stat 50923d2..HEAD
git diff --name-status 50923d2..HEAD | sort

# Tests
git ls-files | grep -E '\.(test|spec)\.[jt]sx?$'
npm run test

# Coherencia
npm run typecheck && npm run lint && npm run build
npm run generate:api && git diff --stat src/lib/api/types.ts
grep -rn "export const runtime\| any\b" src/ middleware.ts

# Smoke
npm run dev  # en otra terminal
for path in /inicio /caja /administracion ; do
  curl -s -o /dev/null -w "%path: %{http_code}\n" "http://localhost:3000$path"
done

# Lighthouse
npm run build && PORT=3009 npm start  # en otra terminal
npx lighthouse http://localhost:3009/login \
  --form-factor=mobile \
  --only-categories=performance,accessibility,best-practices,seo \
  --chrome-flags="--headless=new" \
  --output=json --output-path=lh-login.json
```

---

Generated by CC-WEB — 2026-05-12.
