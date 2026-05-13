# ADR-0005: Mock Service Worker (MSW) para desarrollo y testing de FE sin backend

- **Status:** Proposed
- **Fecha:** 2026-05-13
- **Decididores:** Fernando + CC-WEB
- **Tickets / PRs:** PR de este ADR + PR de implementación (siguiente).

## Contexto

Sprint C0 cerró con la UI de Administración (`/app/administracion/usuarios` + `/aceptar-invitacion`) compilando contra el contrato `docs/backend-contracts/c0-auth-and-users.md`, pero los endpoints reales (`/api/users`, `/api/auth/accept-invitation`, `/api/me`) no existen todavía. Quedan bloqueados en `qavante-api` C0-14/16/17 + #58 (cookie cross-origin). Mientras tanto:

1. **`npm run dev` rinde error state permanente** en `/app/administracion/usuarios` — no se puede iterar UI states (loading, populated, paginated, errors específicos) sin un backend que conteste.
2. **`tests/e2e/auth-redirect.spec.ts` sólo cubre middleware** (12 rutas que redirigen 307 o pasan 200). **Cero cobertura de happy paths** — el flujo "invitar usuario → tabla se actualiza → suspender → status cambia" no se testea hoy.
3. **Demo end-to-end imposible** sin pelearse con cookies / inyectar sesión manual via DevTools (fricción documentada en la sesión de cierre del 2026-05-13).
4. **Sprint C1+ sufre lo mismo**: `sii_f29` y `previred` también van a tener período sin backend, y vendrán otros.

El equipo de `qavante-api` no tiene timeline confirmado para C0-14 — puede ser días o semanas.

## Decisión

Adoptamos **[MSW v2](https://mswjs.io/)** (Mock Service Worker) como capa de mocking HTTP del frontend en entornos **dev y test exclusivamente**. NO en producción (workerd / `@opennextjs/cloudflare`).

### Estructura

- `src/test/msw/handlers.ts` — handlers REST agrupados por dominio (`auth`, `users`, etc.), alineados al shape declarado en `docs/backend-contracts/`.
- `src/test/msw/browser.ts` — setup para `npm run dev` (service worker en `public/mockServiceWorker.js`).
- `src/test/msw/node.ts` — setup para vitest/playwright (Node).
- Activación condicional via env var `NEXT_PUBLIC_API_MOCKING=enabled`. Por defecto **off**: `npm run dev` sin la var apunta al backend real.
- Datos de seed determinísticos (`src/test/msw/fixtures/`), no faker random — los tests no flakean.

### Sincronización con contratos

- Cuando `qavante-api` baje un endpoint y lo regeneremos via `npm run generate:api`, comparamos los nuevos tipos contra los handlers MSW. Si diverge, hay PR explícito que actualiza ambos.
- `docs/backend-contracts/*.md` sigue siendo fuente de verdad del shape esperado. Si MSW devuelve algo que el contrato no documenta, es bug.

### Lifecycle

- Mientras `qavante-api` no exista para un endpoint X → MSW lo mockea siempre que `NEXT_PUBLIC_API_MOCKING=enabled`.
- Cuando `qavante-api` baje endpoint X → MSW sigue disponible para tests/dev, pero por defecto **se prefiere el backend real** en `npm run dev`. La capa de mocks queda como red de seguridad para casos puntuales (ej. probar error states que el backend no genera fácilmente).
- Si después de Sprint C2 ya no hay backends pendientes que justifiquen MSW, podemos depreciarlo. Hasta entonces, queda.

## Alternativas consideradas

- **Mocks manuales por test con `vi.mock('fetch')` o stubs en Playwright** — descartada: lógica scattered, cada test reinventa el shape, no ayuda a `npm run dev` (sólo cubre tests). Funciona pero no escala a Sprint C1+.
- **MirageJS** — descartada: menos actividad de mantenimiento en los últimos 18 meses (compárese con MSW v2 release Oct 2023 + actualizaciones constantes). API REST OK pero la integración con Playwright es menos pulida.
- **`json-server` / mock-backend proceso externo** — descartada: proceso aparte que mantener, no comparte types, requiere correr en CI como sidecar para e2e, fricción de setup en cada dev local.
- **Stub real en Fly (deploy de un `qavante-api-stub`)** — descartada: costo + complejidad de mantener un repo más + riesgo de que el stub drift contra el contrato real.
- **No hacer nada y esperar el backend** — descartada (motivo de este ADR): bloquea progreso de FE 1-N semanas.

## Consecuencias

### Positivas

- Desarrollo FE no espera backend para iterar UI states realistas.
- Tests e2e cubren happy paths reales (invitar usuario → ve la nueva fila → suspender → status cambia), no sólo middleware redirects.
- Demo grabable end-to-end activando `NEXT_PUBLIC_API_MOCKING=enabled` antes del run de prod.
- Documentación viva de los shapes esperados (handlers son ejecutables, los `.md` de contracts no).
- Sprint C1 (sii_f29, previred) y siguientes heredan el approach — ROI compuesto.

### Negativas / tradeoffs aceptados

- **+1 dependencia** (`msw@^2.x`, peso modesto, sólo devDep).
- **Risk de drift mock-vs-real**: si un dev cambia el handler sin actualizar el contrato (`docs/backend-contracts/` o el openapi.json del backend cuando exista), pueden divergir. Mitigación: cuando se regenera `src/lib/api/types.ts` vía `npm run generate:api`, typecheck rompe si los tipos cambian — eso fuerza revisar handlers.
- **Service worker en `public/`** (`public/mockServiceWorker.js` generado por MSW init) — un archivo más a versionear pero MSW lo regenera idempotente con `npx msw init public/`.
- **Activación accidental en prod**: si alguien settea `NEXT_PUBLIC_API_MOCKING=enabled` en Cloudflare Workers, la app sirve mocks. Mitigación: el setup explícitamente verifica `process.env.NODE_ENV !== 'production'` además del flag — doble guarda.

### Acciones que destraba o requiere

- [ ] PR de implementación: install `msw`, setup `src/test/msw/`, primer set de handlers para auth + users.
- [ ] Actualizar `tests/e2e/auth-redirect.spec.ts` para correr con MSW activo + nuevo spec de happy path users (invitar/suspender).
- [ ] Documentar en `CONTRIBUTING.md` cómo activar mocks en dev (`NEXT_PUBLIC_API_MOCKING=enabled npm run dev`).
- [ ] Cuando `qavante-api` C0-14 baje: validar que los handlers MSW siguen alineados al openapi real; ajustar shape si hay drift.

## Referencias

- [MSW docs](https://mswjs.io/docs/) — getting started, browser + node integration.
- [MSW v2 release notes](https://github.com/mswjs/msw/releases/tag/v2.0.0) — breaking changes vs v1, `http.get/post/...` API.
- `docs/backend-contracts/c0-auth-and-users.md` — shape esperado de los endpoints que vamos a mockear primero.
- Audit Anexo K.4 (`docs/audits/c0-milestone-d-review.md`) hallazgo medio #1: `/api/users` no existe → MSW lo resuelve para dev/test.
