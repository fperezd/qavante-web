# Qavante — Kit de arranque Sprint C0

**Versión:** 1.0
**Fecha:** Mayo 2026
**Sprint objetivo:** C0 — Cierre de base SaaS para frontend
**Pre-requisito:** PR-OPS-1, PR-OPS-2, PR-OPS-3 completados (ver sec 2.4 y Anexo A.7 del Documento Maestro v2.6)

---

## Cómo usar este kit

Este documento es la traducción operativa del Sprint C0 del Documento Maestro v2.6. Está pensado para tres audiencias:

1. **Claude Code en sesión interactiva**: el "Primer prompt para Claude Code" (sec 4) es el texto exacto que pegas en la primera sesión.
2. **El equipo humano (Fernando + dev)**: los 18 issues atómicos (sec 3) son la unidad de trabajo. Se pueden crear como issues de GitHub o cards de Linear/Jira.
3. **Quien revise los PRs**: el Definition of Done (sec 5) es el checklist de aprobación.

El kit no reemplaza al Documento Maestro v2.6. Lo complementa. Cuando este kit dice "ver A.5", se refiere al Anexo A.5 del Documento Maestro v2.6.

---

## Sección 1 — Estructura del repositorio

Qavante usa **dos repositorios separados** alineados con la arquitectura cliente-servidor:

| Repo | Contenido | Estado |
|---|---|---|
| `tooxs-gestion-api` (existente, branding interno "qavante-api") | FastAPI + Postgres + migraciones Alembic | En producción |
| `qavante-web` (nuevo, se crea en C0) | Next.js 15 + frontend completo | Por crear |

### 1.1 Decisión: NO renombrar el repo de backend en C0

Alineado con el principio del Documento Maestro v2.6: *"rename conservador: solo nombres internos. NO renombrar Fly app"*. El repo de GitHub `tooxs-gestion-api` se mantiene con su nombre actual durante todo el Sprint C0 para evitar romper URLs históricas de PRs e issues.

- Branding visible (UI, README, copy): "Qavante".
- Repo de GitHub: `tooxs-gestion-api` (sin cambio).
- Fly app: `tooxs-gestion-api` (sin cambio).
- El rename del repo y la Fly app queda como decisión diferida — revisar cuando se cumpla un trigger (Fase 2, dominio nuevo en producción, etc.).
- Si en algún momento se decide renombrar el repo: GitHub mantiene redirects automáticos ~6 meses, no rompe técnicamente nada. Actualizar README, `fly.toml`, recrear Fly app si se quiere.

### 1.2 Estructura del nuevo repo `qavante-web`

```
qavante-web/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # lint + typecheck + tests + build
│       └── deploy-cloudflare.yml     # deploy a Cloudflare Pages desde main
├── public/
│   ├── favicon.ico
│   └── og-image.png
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── recuperar-clave/
│   │   │       └── page.tsx
│   │   ├── (app)/
│   │   │   ├── layout.tsx              # shell con sidebar + header
│   │   │   ├── inicio/
│   │   │   │   └── page.tsx            # placeholder en C0, contenido en C8
│   │   │   ├── caja/page.tsx           # placeholder en C0
│   │   │   ├── cobrar/page.tsx
│   │   │   ├── pagar/page.tsx
│   │   │   ├── gestion/page.tsx
│   │   │   └── administracion/
│   │   │       ├── page.tsx
│   │   │       └── usuarios/page.tsx
│   │   ├── layout.tsx                  # root con providers
│   │   ├── error.tsx                   # error boundary global
│   │   └── not-found.tsx
│   ├── components/
│   │   ├── ui/                         # shadcn components Qavante-tunados
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   └── ...
│   │   ├── shell/
│   │   │   ├── sidebar.tsx
│   │   │   ├── header.tsx
│   │   │   └── breadcrumbs.tsx
│   │   ├── forms/
│   │   │   └── login-form.tsx
│   │   └── assistant/
│   │       └── trigger.tsx             # botón flotante (sin lógica en C0)
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts               # wrapper HTTP
│   │   │   └── types.ts                # generado, no editar
│   │   ├── auth/
│   │   │   ├── session.ts              # función auth() (Auth.js v5 compat)
│   │   │   ├── server.ts               # helpers server-side
│   │   │   └── types.ts                # Session, User
│   │   ├── i18n/
│   │   │   └── es-cl.ts
│   │   ├── validators/
│   │   │   ├── rut.ts
│   │   │   └── currency.ts
│   │   ├── formatters/
│   │   │   ├── clp.ts
│   │   │   ├── date.ts
│   │   │   └── rut.ts
│   │   └── utils.ts
│   ├── hooks/
│   ├── stores/                          # Zustand UI state
│   ├── styles/
│   │   ├── globals.css
│   │   └── tokens.css                   # CSS vars Qavante (Anexo B.2)
│   └── types/
├── tests/
│   ├── unit/
│   └── e2e/                             # Playwright
├── .env.example                         # solo NEXT_PUBLIC_*, sin secretos
├── .eslintrc.json
├── .gitignore
├── .nvmrc                               # Node 22 LTS
├── middleware.ts                        # auth + Edge Runtime
├── next.config.mjs
├── package.json
├── playwright.config.ts
├── postcss.config.mjs
├── README.md
├── tailwind.config.ts
├── tsconfig.json
└── wrangler.toml                        # Cloudflare Pages config
```

---

## Sección 2 — Convenciones de branches y PRs

### 2.1 Branching strategy

- **Rama principal**: `main` (auto-deploy a producción Cloudflare Pages).
- **Rama de integración**: `develop` (auto-deploy a `staging.qavante.cl` o preview de Cloudflare).
- **Ramas de feature**: `c0/<numero-issue>-<slug-corto>`. Ejemplo: `c0/01-init-nextjs-skeleton`.

### 2.2 Convención de commits

Conventional Commits con scope `c0`:

```
feat(c0): init Next.js 15 skeleton with App Router
fix(c0): handle 401 redirect in API client
chore(c0): bump shadcn/ui to latest
test(c0): add e2e for login flow
docs(c0): update README with setup instructions
```

### 2.3 PR template

Crear `.github/pull_request_template.md` con:

```markdown
## Issue
Closes #<numero-issue-c0>

## Cambios
- [ ] Cambio 1
- [ ] Cambio 2

## Definition of Done aplicable
- [ ] Edge Runtime declarado en archivos nuevos
- [ ] Sin uso de `any` sin justificación
- [ ] Tests pasando localmente (npm test)
- [ ] Lighthouse mobile ≥ 85 en rutas afectadas
- [ ] Sin secrets en código
- [ ] Documentación actualizada si aplica

## Screenshots / videos (si aplica)

## Notas para el reviewer
```

### 2.4 Reglas de PR

- Máximo 1 issue por PR.
- Tamaño objetivo: <300 líneas modificadas (excluyendo tests y archivos generados).
- Reviewer obligatorio antes de merge.
- CI verde obligatorio (ci.yml debe pasar).
- Squash-merge a `develop`. PR de `develop` a `main` solo cuando se cierra el sprint C0 completo.

---

## Sección 3 — Issues atómicos del Sprint C0

Los 18 issues están agrupados en 4 milestones del sprint. Cada uno tiene tipo, esfuerzo estimado, dependencias, deliverables y DoD específico.

**Convención de leyenda:**
- ⏱ Esfuerzo: S (<2h), M (2-4h), L (4-8h)
- 🔗 Dependencias: lista de issues que deben cerrar antes
- 🎯 Tipo: setup / backend / frontend / infra / docs

---

### Milestone A — Setup base (issues C0-01 a C0-05)

#### C0-01 — Crear repositorio `qavante-web` con Next.js 15 skeleton

- **Tipo**: setup
- **Esfuerzo**: M
- **Dependencias**: ninguna
- **Deliverables**:
  - Repo nuevo `qavante-web` creado en GitHub.
  - `npx create-next-app@latest qavante-web --typescript --tailwind --app --src-dir --import-alias "@/*"`.
  - Tailwind 4, TypeScript strict mode (`"strict": true`, `"noUncheckedIndexedAccess": true`).
  - Node 22 LTS en `.nvmrc`.
  - `package.json` con scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `e2e`.
  - README inicial con setup, env vars esperadas, comandos básicos.
  - Commit inicial pushed a `main`.
- **DoD**:
  - [ ] `npm run dev` levanta la app en localhost:3000.
  - [ ] `npm run build` termina sin errores.
  - [ ] `npm run typecheck` termina sin errores.
  - [ ] README claro para un dev nuevo.

#### C0-02 — Configurar Cloudflare Pages + dominio

- **Tipo**: infra
- **Esfuerzo**: M
- **Dependencias**: C0-01
- **Deliverables**:
  - Proyecto en Cloudflare Pages conectado al repo `qavante-web`.
  - `wrangler.toml` con config de build: `compatibility_date`, `compatibility_flags = ["nodejs_compat"]`.
  - Build command: `npx @cloudflare/next-on-pages@1.13.2` (versión fijada exacta — bumpear con cuidado, validar build local antes de subir).
  - Output directory: `.vercel/output/static`.
  - Env vars en Cloudflare dashboard:
    - `NEXT_PUBLIC_API_URL=https://qavante-api.fly.dev` (o el dominio que tenga el backend).
    - `NEXT_PUBLIC_APP_ENV=production`.
  - Dominio `qavante.cl` registrado en NIC Chile y apuntando DNS a Cloudflare.
  - SSL automático activo (Cloudflare default).
  - Deploy desde `main` funcionando: cada push a main → deploy a producción.
- **DoD**:
  - [ ] qavante.cl carga la app de Next.js (aunque sea la página default).
  - [ ] HTTPS válido y forzado.
  - [ ] Deploy automático funcionando.
  - [ ] README actualizado con info del despliegue.

#### C0-03 — Instalar dependencias core del frontend

- **Tipo**: setup
- **Esfuerzo**: M
- **Dependencias**: C0-01
- **Deliverables**:
  - Instalar y configurar:
    - `@tanstack/react-query@^5` con devtools.
    - `zustand@^5`.
    - `react-hook-form@^7` + `zod@^3` + `@hookform/resolvers`.
    - `@tanstack/react-table@^8`.
    - `recharts@^2`.
    - `lucide-react`.
    - `date-fns@^3` con locale `es`.
    - `next-intl@^3` con locale base `es-CL`.
    - `cmdk` para command palette.
    - `sonner` para toasts.
    - `openapi-typescript` (devDependency).
  - shadcn/ui inicializado: `npx shadcn@latest init` con tema custom.
  - Componentes shadcn iniciales copiados al repo: `button`, `input`, `dialog`, `form`, `card`, `badge`, `tabs`, `sonner`, `command`.
  - QueryClient provider en `src/app/layout.tsx`.
- **DoD**:
  - [ ] Todas las libs instaladas sin warnings de versión.
  - [ ] `npm run typecheck` verde.
  - [ ] Componentes shadcn copiados y funcionando (probar Button en una página dummy).
  - [ ] QueryClient provider envuelve la app.

#### C0-04 — Configurar ESLint + Prettier + pre-commit hooks

- **Tipo**: setup
- **Esfuerzo**: S
- **Dependencias**: C0-01
- **Deliverables**:
  - ESLint config estricto: `eslint-config-next`, `@typescript-eslint/recommended-strict`, `plugin:react/jsx-runtime`.
  - Prettier config con `printWidth: 100`, `singleQuote: true`, `trailingComma: "all"`.
  - Husky + lint-staged: en pre-commit corre lint + typecheck en archivos staged.
  - `.editorconfig` para consistencia entre editores.
- **DoD**:
  - [ ] `npm run lint` corre y reporta correctamente.
  - [ ] Pre-commit hook bloquea commits con errores.
  - [ ] Prettier formatea on save (config `.vscode/settings.json` opcional).

#### C0-05 — Configurar GitHub Actions CI

- **Tipo**: infra
- **Esfuerzo**: M
- **Dependencias**: C0-04
- **Deliverables**:
  - `.github/workflows/ci.yml` con jobs:
    - `lint` → `npm run lint`.
    - `typecheck` → `npm run typecheck`.
    - `test` → `npm run test` (vitest).
    - `build` → `npm run build`.
    - `secrets-scan` → `gitleaks detect`.
  - Trigger: push a cualquier rama, PR a `develop` y `main`.
  - Status checks obligatorios en branch protection de `main` y `develop`.
- **DoD**:
  - [ ] PR a `develop` ejecuta el CI completo.
  - [ ] Si algún job falla, el merge se bloquea.
  - [ ] Tiempo total CI < 5 minutos.

---

### Milestone B — Sistema de diseño y shell (issues C0-06 a C0-09)

#### C0-06 — Implementar tokens del Sistema de Diseño Qavante

- **Tipo**: frontend
- **Esfuerzo**: M
- **Dependencias**: C0-03
- **Deliverables** (basado en Anexo B del Documento Maestro v2.6):
  - `src/styles/tokens.css` con TODAS las CSS variables del Anexo B.2:
    - Brand: `--brand-primary` y derivados.
    - Neutrales.
    - Semánticos: success/warning/danger/info.
    - Bandas Pulso: 5 niveles.
    - Radios y sombras.
  - `tailwind.config.ts` extendido para usar las CSS variables como colores de Tailwind.
  - Tipografía Inter via `next/font/google` aplicada como default sans.
  - Escala de tamaños text-* del Anexo B.3 mapeada a Tailwind.
- **DoD**:
  - [ ] Página dummy `/playground` que muestra todos los colores y tamaños tipográficos.
  - [ ] `bg-brand-primary`, `text-pulso-saludable`, etc. funcionan en JSX.
  - [ ] Inter cargada sin FOUT (font-display: swap).

#### C0-07 — Componentes de design system Qavante (capa 1)

- **Tipo**: frontend
- **Esfuerzo**: L
- **Dependencias**: C0-06
- **Deliverables** (componentes de Anexo B.6, primera tanda):
  - `QavanteButton` (sobre shadcn Button): variantes primary, secondary, ghost, danger, link. Tamaños sm/md/lg. Loading state.
  - `QavanteInput`: variantes text, number, currency CLP (formateo), date, rut (con validador del lib/validators/rut.ts).
  - `QavanteCard`: default, elevated, bordered. Header y footer opcionales.
  - `QavanteBadge`: default, success, warning, danger, info.
  - `QavanteEmpty`: estado vacío con ícono Lucide, título, descripción, CTA. Texto default según Anexo F.7.
  - `QavanteSourceTag`: etiqueta para indicar fuente del dato (SII, BICE, Buk, etc).
  - Storybook NO se instala en C0 (queda diferido). Validación manual via `/playground`.
- **DoD**:
  - [ ] Cada componente con TypeScript types completos (sin `any`).
  - [ ] Documentación inline (JSDoc) con props y ejemplo de uso.
  - [ ] `/playground` muestra todos los componentes con sus variantes.
  - [ ] Accesibilidad: aria-labels en botones, foco visible, navegable con teclado.

#### C0-08 — Layout shell global

- **Tipo**: frontend
- **Esfuerzo**: L
- **Dependencias**: C0-07
- **Deliverables** (basado en Anexo B.7):
  - `src/app/(app)/layout.tsx` (Server Component) con grid: header sticky 56px arriba, sidebar 240px izquierda, contenido principal max-width 1440px.
  - `src/components/shell/sidebar.tsx` con los 6 módulos: Inicio, Caja, Cobrar, Pagar, Gestión, Administración. Active state con `usePathname()`. Iconos Lucide.
  - `src/components/shell/header.tsx` con: logo Qavante, selector de empresa (placeholder), búsqueda global CMD+K (placeholder, no funcional aún), Pulso badge (placeholder), notificaciones bell (placeholder), avatar usuario.
  - `src/components/shell/breadcrumbs.tsx` derivado de `usePathname()`.
  - `src/components/assistant/trigger.tsx`: botón flotante "Preguntar a Qavante", esquina inferior derecha. En C0 no abre nada al click (placeholder).
  - Responsive: sidebar colapsable en mobile (off-canvas).
- **DoD**:
  - [ ] Layout pixel-perfect contra el ASCII art del Anexo B.7.
  - [ ] Sidebar destaca módulo activo correctamente.
  - [ ] Botón flotante visible en todas las páginas behind-login.
  - [ ] Mobile: sidebar se esconde, botón hamburguesa la abre.
  - [ ] Lighthouse mobile ≥ 85 en `/inicio` (placeholder).

#### C0-09 — Páginas placeholder de los 6 módulos

- **Tipo**: frontend
- **Esfuerzo**: S
- **Dependencias**: C0-08
- **Deliverables**:
  - Una `page.tsx` por cada módulo: `/app/inicio`, `/caja`, `/cobrar`, `/pagar`, `/gestion`, `/administracion`.
  - Cada page muestra:
    - Título de pantalla con la pregunta central correspondiente (Anexo C de Fernando v2.4 — sec 4.1).
    - QavanteEmpty diciendo "Esta pantalla se construye en Sprint Cx" con link al issue tracker.
  - Cada page declara `export const runtime = 'edge';`.
  - Cada page es Client Component (`'use client'`) salvo el layout.
- **DoD**:
  - [ ] Las 6 rutas cargan sin error.
  - [ ] Cada una tiene su pregunta central como título.
  - [ ] Edge Runtime declarado en todas.
  - [ ] Tests E2E básicos: navegar de una a otra desde el sidebar.

---

### Milestone C — Auth y conexión backend (issues C0-10 a C0-13)

#### C0-10 — Cliente API tipado contra FastAPI

- **Tipo**: frontend
- **Esfuerzo**: M
- **Dependencias**: C0-03
- **Deliverables** (basado en Anexo A.4):
  - `src/lib/api/client.ts`: wrapper sobre `fetch` con:
    - Base URL desde `NEXT_PUBLIC_API_URL`.
    - Inclusión automática de cookie de sesión (`credentials: 'include'`).
    - Interceptor de 401: dispara refresh token automático, si falla redirige a `/login`.
    - Errores tipados con `ApiError` class y mensaje localizado según Anexo C.3.
    - AbortController automático.
  - `src/lib/api/types.ts`: generado vía `npm run generate:api` desde el OpenAPI del backend FastAPI.
  - Script `generate:api` en package.json.
  - Hook `useApi()` que devuelve cliente con auth.
- **DoD**:
  - [ ] `generate:api` corre y produce types.ts sin errores.
  - [ ] Llamada de prueba a `/health-lite` desde el frontend retorna OK.
  - [ ] 401 dispara refresh y reintenta automáticamente.
  - [ ] Errores muestran mensaje humano según tabla del Anexo C.3.

#### C0-11 — Backend: endpoints de auth (login/logout/refresh/me)

- **Tipo**: backend
- **Esfuerzo**: L
- **Dependencias**: ninguna (es trabajo en repo `qavante-api`)
- **Deliverables** (basado en Anexo I.0):
  - `POST /api/auth/login`: recibe `{rut, password}`, valida contra users, genera JWT (15 min) + refresh token (UUID guardado en `auth.refresh_tokens`), setea cookie httpOnly Secure SameSite=Strict.
  - `POST /api/auth/refresh`: lee cookie, valida en DB, rota el refresh token, retorna nuevo access token.
  - `POST /api/auth/logout`: revoca el refresh token en DB (`revoked_at = NOW()`), limpia cookie.
  - `GET /api/me`: retorna `{id, name, email, role, tenant_id, permissions[]}` desde la sesión.
  - Migración Alembic 0011: tabla `auth.refresh_tokens` (DDL exacto del Anexo I.0.2).
  - Rate limiter: máximo 10 intentos de login fallidos por hora por RUT. Implementación in-memory en C0 con TTL de 1h. Si en algún sprint futuro se requiere rate limit distribuido (multi-instancia), evaluar opciones (Redis, Cloudflare Rate Limiting, Postgres con `auth.login_attempts`) y agregar la decisión al Documento Maestro antes de implementarla.
  - Tests pytest para los 4 endpoints.
- **DoD**:
  - [ ] Migración 0011 aplicada en staging.
  - [ ] Los 4 endpoints documentados en OpenAPI.
  - [ ] Tests cubren happy path + errores (RUT inválido, password wrong, rate limit, refresh expirado, logout).
  - [ ] CORS configurado para aceptar `https://qavante.cl` y `localhost:3000`.

#### C0-12 — Frontend: pantalla de login + flujo completo

- **Tipo**: frontend
- **Esfuerzo**: L
- **Dependencias**: C0-07, C0-10, C0-11
- **Deliverables**:
  - `/login` con formulario RHF + Zod:
    - Campo RUT (con validador chileno y formateo automático 12.345.678-9).
    - Campo Clave (password, mostrar/ocultar).
    - Botón "Iniciar sesión" con loading state.
    - Link "¿Olvidaste tu clave?" → `/recuperar-clave` (placeholder).
    - Mensaje de error inline ante credenciales incorrectas.
  - Flujo: submit → `POST /api/auth/login` → si OK redirect a `/inicio`, si error muestra mensaje según Anexo C.3.
  - Página `/recuperar-clave` placeholder con texto "Funcionalidad disponible próximamente".
  - Edge Runtime declarado.
- **DoD**:
  - [ ] Login con credenciales correctas redirige a `/inicio`.
  - [ ] Login con credenciales incorrectas muestra "Credenciales incorrectas" sin filtrar info.
  - [ ] Rate limit a 10 intentos muestra "Hiciste muchos intentos, espera 60 minutos".
  - [ ] Tab order del formulario es lógico, accesible con teclado.
  - [ ] Mobile responsive.

#### C0-13 — Middleware de Next.js para protección de rutas

- **Tipo**: frontend
- **Esfuerzo**: M
- **Dependencias**: C0-11, C0-12
- **Deliverables** (basado en Anexo A.5 y A.5.1):
  - `middleware.ts` en raíz del proyecto, Edge Runtime.
  - Lógica: si la URL empieza con `/app/*` y NO hay cookie de sesión válida → redirect a `/login?redirect=<original>`.
  - Si hay cookie pero está expirada → intenta refresh automático antes de redirigir.
  - `src/lib/auth/session.ts`: función `auth()` que retorna `Session | null`. Compatible con la API de Auth.js v5 (preparado para Fase 2 según A.5.1).
  - `src/lib/auth/types.ts`: tipos `Session`, `User`.
- **DoD**:
  - [ ] Acceder a `/app/inicio` sin login redirige a `/login?redirect=/app/inicio`.
  - [ ] Después de login redirige al `redirect` original.
  - [ ] `auth()` server-side retorna la sesión correctamente.
  - [ ] Logout limpia cookies y redirige a `/login`.

---

### Milestone D — Administración mínima + cierre (issues C0-14 a C0-18)

#### C0-14 — Backend: User CRUD + invitación de usuarios

- **Tipo**: backend
- **Esfuerzo**: L
- **Dependencias**: C0-11
- **Deliverables** (basado en Anexo I.0.1):
  - `GET /api/users`: lista users del tenant. Permiso: `admin` o `owner`.
  - `POST /api/users` (invitar): crea registro en `user_invitations` con token único, envía email vía Resend con link `https://qavante.cl/aceptar-invitacion?token=xxx`. Permiso: `admin` o `owner`.
  - `PATCH /api/users/{id}`: cambia rol o status. Validación: el último owner no puede cambiar su rol.
  - `POST /api/auth/accept-invitation`: recibe token, permite al invitado setear su clave inicial.
  - `GET /api/users/me/permissions`: retorna lista de permisos del usuario actual (Anexo C.4).
  - Tests pytest para los 5 endpoints + casos edge (último owner, token expirado, etc).
- **DoD**:
  - [ ] Los 5 endpoints documentados en OpenAPI.
  - [ ] Email de invitación llega y el link funciona.
  - [ ] Test: owner no puede degradarse si es el único.
  - [ ] Token de invitación expira a los 7 días.

#### C0-15 — Frontend: pantalla de Administración → Usuarios

- **Tipo**: frontend
- **Esfuerzo**: L
- **Dependencias**: C0-13, C0-14
- **Deliverables**:
  - `/app/administracion/usuarios` con:
    - Tabla TanStack Table con columnas: nombre, email, rol, estado, último login, acciones.
    - Botón "Invitar usuario" → modal con email + selector de rol.
    - Acción "Cambiar rol" inline.
    - Acción "Suspender" con confirm dialog.
    - Estado vacío con CTA "Invita al primer usuario".
  - Solo visible si el usuario actual es `admin` u `owner`.
  - Página de aceptación de invitación: `/aceptar-invitacion?token=xxx` con form para setear clave inicial.
- **DoD**:
  - [ ] Owner puede invitar a un finance_manager.
  - [ ] El invitado recibe email, hace click, setea clave, queda autenticado en la app.
  - [ ] Viewer no ve el módulo Administración (sidebar lo esconde).
  - [ ] Edge cases: invitar email duplicado, rol inválido, token expirado, todos manejados con Anexo C.3.

#### C0-16 — Backend: aplicar RBAC dependency a endpoints existentes

- **Tipo**: backend
- **Esfuerzo**: M
- **Dependencias**: C0-11
- **Deliverables**:
  - FastAPI dependency `require_role(*roles)` que usa el JWT y valida que el rol del usuario está en la lista.
  - Aplicar a TODOS los endpoints existentes (Sprint 1A, 1B, 2, 3) según matriz del Anexo C.4.
  - Endpoint que requiere permiso insuficiente devuelve 403 (no 401), con código `permission_denied`.
  - Tests pytest: para cada endpoint, intentar con un rol no permitido y verificar 403.
- **DoD**:
  - [ ] Matriz Anexo C.4 cubierta al 100% en endpoints existentes.
  - [ ] 403 devuelve mensaje genérico (no filtra qué rol falta).
  - [ ] Tests cubren al menos un endpoint por rol.

#### C0-17 — Preparación de RLS para segundo tenant en staging

- **Tipo**: backend
- **Esfuerzo**: M
- **Dependencias**: C0-16
- **Deliverables**:
  - Crear segundo tenant en staging con datos sintéticos mínimos (1 usuario admin, 1 fuente conectada).
  - Activar RLS en migration 0008 (que está scaffolded pero no activo) en staging.
  - Probar que un usuario de tenant A no puede ver datos de tenant B (queries directas a la DB).
  - Documentar en `docs/RLS_VALIDATION.md` el procedimiento y resultados.
  - **NO activar RLS en producción todavía**. Eso queda diferido hasta tener datos reales del segundo tenant.
- **DoD**:
  - [ ] Segundo tenant funcional en staging.
  - [ ] RLS activo en staging.
  - [ ] Test de aislamiento pasa: tenant A no lee filas de tenant B.
  - [ ] `docs/RLS_VALIDATION.md` con resultados.

#### C0-18 — Documentación, README final y cierre del Sprint C0

- **Tipo**: docs
- **Esfuerzo**: M
- **Dependencias**: todos los anteriores
- **Deliverables**:
  - README de `qavante-web` completo: setup, env vars, comandos, arquitectura básica, link al Documento Maestro v2.6.
  - README de `qavante-api` actualizado con: nuevos endpoints de C0, RBAC dependency, migración 0011.
  - `CONTRIBUTING.md` en ambos repos con: branching strategy, conventional commits, PR template, DoD.
  - `docs/ARCHITECTURE.md` con diagrama simplificado: cliente Cloudflare Pages → API Fly → Postgres Fly + R2 backups.
  - Demo interna grabada (5-10 min): login, navegar módulos, invitar usuario, suspender usuario.
  - Tag de release: `c0-complete-2026-MM-DD` en ambos repos.
- **DoD**:
  - [ ] README ambos repos completos y verificados por un dev externo al desarrollo.
  - [ ] Demo grabada y compartida con Fernando.
  - [ ] Tag de release creado.
  - [ ] Lista de issues C0 cerrada al 100% en GitHub.

---

## Sección 4 — Primer prompt para Claude Code

Este es el texto exacto que pegas en la primera sesión de Claude Code, después de haber completado los pre-requisitos PR-OPS-1, PR-OPS-2 y PR-OPS-3.

```
Hola Claude Code. Soy Fernando, dueño de Qavante (plataforma SaaS de gestión financiera para PYMEs chilenas).

Vas a trabajar conmigo en el Sprint C0 — Cierre de base SaaS para frontend.

DOCUMENTACIÓN OBLIGATORIA QUE DEBES LEER ANTES DE ESCRIBIR CÓDIGO:

1. Documento Maestro v2.6 (qavante_fase1_v2.6.docx) — fuente única de verdad para producto y stack. En particular:
   - Sec 1-14: decisiones de producto y prioridades.
   - Anexo A: stack tecnológico obligatorio.
   - Anexo B: sistema de diseño Qavante.
   - Anexo C: estados canónicos, niveles de confianza, mapping errores, matriz roles.
   - Anexo D: modelos TypeScript de referencia.
   - Anexo E: estructura de carpetas + 39 rutas.
   - Anexo F: Voice & Tone Guide.
   - Anexo I.0: spec técnica detallada del Sprint C0.

2. Kit Sprint C0 (QAVANTE_SPRINT_C0_KIT.md) — este documento. Contiene los 18 issues atómicos a implementar, en orden.

VERIFICACIONES PREVIAS QUE TIENES QUE HACER:

Antes de tocar código, verifica:
- ¿Está completado PR-OPS-1 (backups DB en R2)? Si no, detente y avisa.
- ¿Está completado PR-OPS-2 (runbook DR)? Si no, detente y avisa.
- ¿Está completado PR-OPS-3 (test de restore)? Si no, detente y avisa.

Si los 3 están completados, podemos arrancar.

REGLAS DURANTE EL SPRINT:

1. Trabajamos issue por issue, en el orden del kit (C0-01, C0-02, ... C0-18).
2. Por cada issue: rama nueva, commits con scope c0, PR contra develop.
3. Cumple SIEMPRE el Definition of Done específico del issue.
4. Edge Runtime obligatorio en CADA page.tsx, route.ts, middleware.ts. Sin excepción.
5. NO uses `any` sin justificación documentada en el código.
6. NO instales librerías que estén en la lista de prohibidas (Anexo A.3).
7. NO modifiques las migraciones existentes (0001-0010). Si necesitas schema nuevo, crea migration nueva.
8. NO toques los conectores ya wireados (BICE, SII RCV, DTE, BHE, Buk, TGR).
9. Cada PR debe ser <300 líneas modificadas, 1 issue por PR.
10. Si encuentras una contradicción entre el kit y el doc maestro, GANA EL DOC MAESTRO. Avísame para resolver.

QUÉ HACER AHORA:

Empieza por el issue C0-01: "Crear repositorio qavante-web con Next.js 15 skeleton".
Lee la spec del issue en el kit, lee la sec correspondiente del doc maestro, y procede.

Antes de cada issue, dime brevemente:
- Qué vas a hacer.
- Qué archivos vas a crear o modificar.
- Si tienes alguna duda específica.

Si todo está claro, espero tu primer plan para C0-01.
```

---

## Sección 5 — Definition of Done global del Sprint C0

Además del DoD específico de cada issue, el sprint completo C0 cumple cuando se cumplen TODOS estos criterios globales:

### 5.1 DoD funcional

- [ ] Un usuario puede registrarse en `qavante.cl/login` con RUT y clave.
- [ ] Después de login, ve la app con sidebar y los 6 módulos visibles según su rol.
- [ ] Owner puede invitar un usuario con rol específico, el invitado recibe email y completa registro.
- [ ] Un viewer no ve el módulo Administración.
- [ ] Las 6 páginas placeholder cargan sin error y declaran su pregunta central.
- [ ] El frontend conecta con el backend FastAPI productivo en Fly.io.
- [ ] No hay funcionalidad de C1 a C9 implementada anticipadamente.

### 5.2 DoD técnico

- [ ] Repo `qavante-web` creado, en `main` con tag `c0-complete-YYYY-MM-DD`.
- [ ] Auto-deploy a Cloudflare Pages funciona desde main.
- [ ] CI verde en main: lint, typecheck, tests, build, secrets-scan.
- [ ] Lighthouse mobile ≥ 85 en `/login` y `/app/inicio` (placeholder).
- [ ] Edge Runtime declarado en TODAS las páginas, rutas y middleware.
- [ ] Sin uso de `any` en código de aplicación (permitido en tests con justificación).
- [ ] Bundle size de `/login` < 200 KB gzip.
- [ ] Migration 0011 aplicada en producción.
- [ ] RBAC dependency aplicada a todos los endpoints existentes.
- [ ] Segundo tenant en staging con RLS activo y validado.

### 5.3 DoD de seguridad

- [ ] Ningún secret en código (validado por gitleaks).
- [ ] JWT firmado con clave que está en Fly secrets, nunca en repo.
- [ ] Refresh tokens en cookies httpOnly + Secure + SameSite=Strict.
- [ ] CORS configurado solo para dominios oficiales (qavante.cl, localhost:3000 en dev).
- [ ] Rate limit de login a 10 intentos/hora/RUT funciona.
- [ ] Endpoints con permisos suficientes devuelven 403 (no 401) cuando rol no aplica.

### 5.4 DoD documental

- [ ] README de `qavante-web` completo.
- [ ] README de `qavante-api` actualizado.
- [ ] CONTRIBUTING.md en ambos repos.
- [ ] docs/ARCHITECTURE.md con diagrama del stack actual.
- [ ] docs/RLS_VALIDATION.md con resultado del test de aislamiento entre tenants.
- [ ] Demo grabada (video) compartida con Fernando.

### 5.5 DoD de no-degradación

- [ ] Sprint 1A, 1B, 2 siguen funcionando exactamente igual que antes.
- [ ] Conectores BICE, SII RCV/DTE/BHE, Buk, TGR siguen wireados y funcionales.
- [ ] No hay duplicación de fuentes de datos.
- [ ] No hay rewrite de migraciones existentes.

---

## Sección 6 — Bonus: Kit pre-requisitos operacionales (PR-OPS)

Antes de C0-01 hay que cerrar los 3 PR-OPS de la sec 2.4 del Documento Maestro v2.6. Resumen accionable:

### PR-OPS-1: Backups DB a Cloudflare R2

Crear `.github/workflows/db-backup.yml` en repo `qavante-api`:

```yaml
name: DB Backup to R2

on:
  schedule:
    - cron: "0 6 * * 0"  # Domingo 06:00 UTC = 03:00 Chile
  workflow_dispatch:      # permite trigger manual

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Setup flyctl
        uses: superfly/flyctl-actions/setup-flyctl@master

      - name: Dump DB via flyctl proxy
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
        run: |
          # Levanta el proxy en background y espera a que el puerto esté listo (no usar sleep arbitrario)
          flyctl proxy 5433:5432 -a tooxs-gestion-db &
          for i in $(seq 1 30); do
            pg_isready -h localhost -p 5433 -q && break
            sleep 1
          done
          # Si después de 30s no responde, abortar
          pg_isready -h localhost -p 5433 -q || (echo "flyctl proxy no respondió en 30s" && exit 1)

          PGPASSWORD="${{ secrets.PG_PASSWORD }}" pg_dump \
            --host localhost --port 5433 --username postgres \
            --format=custom --no-owner --verbose \
            --file=qavante-$(date +%Y-%m-%d).dump postgres

      - name: Upload to R2
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: |
          npx wrangler r2 object put \
            qavante-db-backups/daily/qavante-$(date +%Y-%m-%d).dump \
            --file=qavante-$(date +%Y-%m-%d).dump

      - name: Notify Sentry on failure
        if: failure()
        run: |
          curl -X POST "${{ secrets.SENTRY_WEBHOOK_URL }}" \
            -H "Content-Type: application/json" \
            -d '{"message":"DB backup failed","level":"error"}'
```

Configurar lifecycle rule en R2 dashboard:
- Bucket: `qavante-db-backups`.
- Prefix: `daily/`.
- Action: Delete after 90 days.

Secrets necesarios en GitHub (Settings → Secrets and variables → Actions):

| Secret | Cómo obtenerlo |
|---|---|
| `FLY_API_TOKEN` | `flyctl auth token` desde tu CLI ya autenticado. Vale por años. Nunca compartir. |
| `PG_PASSWORD` | Recuperar de la URL `DATABASE_URL` que está en Fly secrets de `tooxs-gestion-api`. Comando: `flyctl ssh console -a tooxs-gestion-api -C 'printenv DATABASE_URL'` y parsear el password (entre `:` y `@`). Como alternativa, `flyctl postgres connect -a tooxs-gestion-db` y desde `psql` correr `\password postgres` para setear uno conocido (rota la credencial). |
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template (incluye permiso R2 Edit). |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → cualquier dominio o R2 → sidebar derecha "Account ID". |
| `SENTRY_WEBHOOK_URL` | Opcional. Sentry → Settings → Integrations → Webhooks. Útil si querés alerta automática cuando el backup falla. |

### PR-OPS-2: Runbook DR

Copiar el contenido completo del Anexo A.7 del Documento Maestro v2.6 a `docs/DR_RESTORE.md` en el repo `qavante-api`. Versionarlo. Validarlo con un compañero.

### PR-OPS-3: Test de restore

Ejecutar el procedimiento del Anexo A.7 una vez completo. Documentar en `docs/DR_TESTS.md`:

```markdown
# DR Test Log

## Test 1 — YYYY-MM-DD

- Ejecutor: <nombre>
- Backup usado: qavante-YYYY-MM-DD.dump (tamaño: X MB)
- Tiempo total: HH:MM (RTO)
- Diff de filas vs primario: 0 / N filas
- Constraints OK: sí / no
- Auditoría sin gaps: sí / no
- Descifrado credencial OK: sí / no
- Observaciones: ...
- Resultado: ✅ PASA / ❌ FALLA
```

Repetir trimestralmente.

---

## Sección 7 — Estimación temporal y ruta crítica

### 7.1 Estimación por milestone

| Milestone | Issues | Esfuerzo total | Calendario sugerido |
|---|---|---|---|
| Pre-OPS | PR-OPS-1, 2, 3 | 1-2 días | Semana 0 |
| A — Setup base | C0-01 a C0-05 | 2-3 días | Semana 1 |
| B — Design + shell | C0-06 a C0-09 | 4-5 días | Semana 1-2 |
| C — Auth + backend | C0-10 a C0-13 | 5-6 días | Semana 2-3 |
| D — Admin + cierre | C0-14 a C0-18 | 5-7 días | Semana 3-4 |

**Total Sprint C0: 4 semanas con 1 dev a tiempo completo + Claude Code asistiendo.**

### 7.2 Ruta crítica

```
PR-OPS (1-2d)
   ↓
C0-01 (skeleton) → C0-02 (Cloudflare) → C0-03 (deps)
   ↓                                       ↓
C0-04 (lint/prettier)                    C0-06 (tokens diseño)
   ↓                                       ↓
C0-05 (CI)                                C0-07 (componentes)
   ↓                                       ↓
                                          C0-08 (shell)
                                            ↓
                                          C0-09 (placeholders)

(Backend en paralelo) C0-11 (auth backend) → C0-14 (user CRUD) → C0-16 (RBAC)
                                                ↓                    ↓
                                              C0-15 (admin frontend)
                                                ↓
                                              C0-17 (RLS staging)
                                                ↓
C0-10 (api client) → C0-12 (login) → C0-13 (middleware) → C0-18 (cierre)
```

Issues que pueden ir en paralelo:
- C0-04 y C0-06 (lint y tokens) son independientes.
- C0-05 (CI) depende de C0-04 pero puede ir mientras se hace C0-06/07.
- C0-11 (auth backend) puede arrancar antes que C0-10 (api client) porque está en otro repo.

---

## Sección 8 — Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Cloudflare next-on-pages tiene incompatibilidad con alguna lib | Media | Alto | Validar en C0-01 con un build temprano. Si falla, usar Pages Functions o evaluar workaround. |
| Migración 0011 (auth.refresh_tokens) rompe algo en producción | Baja | Alto | Aplicar primero en staging. Hacer test de regresión completo antes de producción. |
| RLS activado en staging genera queries lentas | Media | Medio | Index review post C0-17. Si performance cae >20%, optimizar policies. |
| Algún conector existente se rompe por cambios en RBAC dependency | Baja | Alto | Tests de regresión obligatorios en C0-16. Si rompe, revertir y aplicar quirúrgicamente. |
| Resend free tier insuficiente para invitaciones masivas | Baja en C0 | Medio | C0 tiene <10 usuarios totales. Revisar en Fase 2. |
| Lighthouse mobile <85 en /login | Media | Bajo | Optimizar fonts (preload), images (lazy), bundle (analyze). |
| Bundle size /login >200 KB | Baja | Bajo | Webpack-bundle-analyzer y code splitting si excede. |

---

## Sección 9 — Métricas de éxito post-C0

Al cerrar Sprint C0 (`c0-complete-YYYY-MM-DD` taggeado), se mide:

| Métrica | Objetivo | Cómo medir |
|---|---|---|
| Tiempo total Sprint C0 | ≤ 4 semanas | Diff entre primer commit y tag |
| Issues cerrados | 18/18 | GitHub project board |
| PRs mergeados | 18+ (1 por issue mínimo) | GitHub PRs |
| Lighthouse mobile `/login` | ≥ 85 | Lighthouse CI |
| Lighthouse mobile `/app/inicio` | ≥ 90 | Lighthouse CI |
| Tiempo de login → ver inicio | < 5s en LTE | Test E2E |
| Cobertura de tests unitarios | ≥ 50% en `lib/auth/` | Vitest coverage |
| Bundle size `/login` | < 200 KB gzip | Next.js build output |
| Costo del stack post-C0 | ≤ $15/mes | Fly + Cloudflare + Resend dashboards |
| RTO validado en test DR | ≤ 2 horas | docs/DR_TESTS.md |

---

## Sección 10 — Después de C0: hoja de ruta hacia primera entrega útil

Una vez cerrado C0, el orden de los siguientes sprints es estricto:

1. **C1** (~2 sem) — Cierre fuentes críticas (sii_f29, previred).
2. **C2** (~3 sem) — Modelo canónico y clasificación bancaria.
3. **C3** (~3 sem) — Caja proyectada 13 semanas (corazón del producto).
4. **C4** (~3 sem) — Cobrar y Pagar.
5. **C5** (~2 sem) — Resultado Operacional de Gestión.
6. **C6** (~2 sem) — Drivers y next best actions.
7. **C7** (~2 sem) — Pulso Empresa preliminar (validar pesos H.3 contra empresas reales).
8. **C8** (~2 sem) — Inicio Ejecutivo definitivo.
9. **C9** (~3 sem) — Asistente Inteligente MVP con Gemini.

**Total estimado de C1 a C9: 22 semanas con 1 dev full-time.**

**Primera entrega útil completa estimada: ~6 meses desde el inicio de C0.**

Eso te deja para validar con primeros clientes pagando hacia fines de 2026 / inicios de 2027.

---

**Fin del Kit Sprint C0.**

Cualquier desviación del kit requiere actualizar el Documento Maestro v2.6 primero. El kit es la traducción operativa, no fuente de verdad.

---

*Generado el 5 de mayo de 2026 — Versión 1.0*
