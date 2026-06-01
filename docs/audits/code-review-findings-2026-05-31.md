# Code-review multi-agente — hallazgos para revisión humana (2026-05-31)

> Generado en la sesión autónoma 2026-05-30/31. Un workflow de 6 revisores +
> verificación adversarial (18 agentes) revisó el codebase buscando bugs de
> correctitud. **10 hallazgos confirmados.** 5 se arreglaron autónomamente
> (low-risk, no-auth) en [PR #244](https://github.com/fperezd/qavante-web/pull/244)
> (voseo, fallback de nombre vacío, a11y).
>
> Los **5 de abajo se DIFIRIERON** porque tocan auth/middleware (acordé con
> Fernando no tocarlos sin él) o son juicio de producto. Cada uno tiene fix
> sugerido listo. **Acción: Fernando revisa y decide.**

## 🔐 #1 — `client.ts`: un 401 que persiste tras refresh 2xx no redirige a /login

- **Archivo:** [`src/lib/api/client.ts:64-86`](../../src/lib/api/client.ts#L64) · severidad **med** · confidence **high** · **toca auth**
- **Qué:** El flujo `401 → refresh → retry` redirige a `/login` SOLO cuando `tryRefresh()` devuelve `false`. Si el refresh responde 2xx pero el retry (con `skipAuthRetry:true`) **vuelve a dar 401** (caso real: rotación de refresh token, o cookie nueva que sigue sin autorizar), la condición de la línea 64 es falsa → NO entra al bloque de redirect → cae al `!response.ok` y lanza un `ApiError` 401 plano **sin redirigir**. El usuario queda en la pantalla con "Error 401" en vez de ir a login.
- **Contradice:** `docs/backend-contracts/c0-auth-and-users.md:136` ("cualquier 4xx → `window.location.href = /login`").
- **Gap de test:** `client.test.ts` cubre los 3 caminos felices pero NO el caso `retry→401`.
- **Fix sugerido:** centralizar el redirect a `/login` para cualquier 401 final no recuperable, reusando el mismo guard (`window` definido, `pathname !== /login`, `path !== /api/auth/refresh`) que ya está en líneas 69-72. **Riesgo:** med — es el interceptor central; un fix descuidado puede meter loop de redirect. Por eso lo dejo para revisión consciente.

## 🔐 #2 — `client.ts`: respuesta 2xx con body vacío + content-type JSON propaga SyntaxError crudo

- **Archivo:** [`src/lib/api/client.ts:88-94`](../../src/lib/api/client.ts#L88) · severidad **low** · confidence **med** · **toca el cliente central**
- **Qué:** La línea 91-92 hace `await response.json()` **fuera de cualquier try/catch**. Una respuesta 2xx con `Content-Type: application/json` y body vacío lanza `SyntaxError: Unexpected end of JSON input` **crudo** (no envuelto en `ApiError`), rompiendo el contrato implícito de que todo fallo llega como `ApiError`. Relevante para `handleLogoutError` (users.ts), que solo traga `ApiError` 401 y re-lanza el resto → un SyntaxError escaparía como unhandled rejection.
- **Trigger actual:** ninguno documentado (logout es 204 → cae en el guard de la línea 88). El path defectuoso existe pero requiere backend no estándar.
- **Fix sugerido:** tratar `content-length: 0`/body vacío como `undefined as T` (igual que 204), y envolver el `json()` de éxito en try/catch que produzca `ApiError`/`undefined`. **Riesgo:** low, pero está en `client.ts` → lo dejo para revisión junto con #1.

## 🔐 #7 — `middleware.ts`: el matcher no cubre `/mi-cuenta` (ruta autenticada sin gate server-side)

- **Archivo:** [`src/middleware.ts:28-35`](../../src/middleware.ts#L28) · severidad **med** · confidence **high** · **toca middleware/auth**
- **Qué:** El matcher lista 6 prefijos (`/inicio`, `/caja`, `/cobrar`, `/pagar`, `/gestion`, `/administracion`) pero **no `/mi-cuenta`**, que es ruta autenticada real (bajo `(app)/`, enlazada desde el avatar del header, alcanzable desde toda pantalla). El `(app)/layout.tsx` NO redirige por sí mismo (delega al middleware). Por lo tanto un usuario sin cookie que navegue directo a `/mi-cuenta` **no es redirigido a /login** por el server, a diferencia de las otras 6. Mitigación parcial client-side (el 401 de `/api/me` redirige), pero más débil (flash de shell + depende de que `/api/me` devuelva 401, y es uno de los endpoints "sin security declarado").
- **Mitigado hoy:** el flag `miCuenta` está OFF en prod → una visita no-auth solo ve el `QavanteEmpty` estático. La exposición real aparece con el flag ON.
- **Fix sugerido:** agregar `"/mi-cuenta/:path*"` al matcher (espejo de las 6 entradas). Idealmente cubrir todo el route group `(app)` para que futuras rutas no se escapen. **Riesgo:** low (sumar una ruta al gate no rompe las otras), pero es middleware/auth → tu llamada.

## ⚖️ #3 — `treasury.ts`: clasificar no invalida el cash-flow report (tradeoff documentado)

- **Archivo:** [`src/lib/api/treasury.ts:70-77`](../../src/lib/api/treasury.ts#L70) · severidad **low** · confidence **low** · no-auth
- **Qué:** `useClassifyBankMovement.onSuccess` invalida solo `treasuryKeys.all` (`["treasury"]`). El reporte vive bajo `treasuryReportsKeys.all` (`["treasury-reports"]`) → la invalidación por prefijo no lo alcanza. Tras clasificar, el cash-flow report puede mostrar datos viejos hasta `staleTime` (30s) o refetch-on-focus.
- **Por qué lo DIFIERO:** el autor documentó el tradeoff explícito en `treasury-reports.ts:85-86` ("Refresh on focus alcanza"). No es un olvido — es una decisión consciente. Override-earla autónomamente pisaría esa decisión. **Tu llamada:** agregar invalidación cruzada (`qc.invalidateQueries({ queryKey: treasuryReportsKeys.all })`) si quieres reflejo inmediato, o dejarlo (ambas pantallas están en rutas distintas, la ventana de 30s es angosta).

## ⚖️ #5 — `por-clasificar-view.tsx`: traga errores de carga de cuentas/categorías

- **Archivo:** [`src/components/clasificacion/por-clasificar-view.tsx:81-83`](../../src/components/clasificacion/por-clasificar-view.tsx#L81) · severidad **low** · confidence **med** · no-auth
- **Qué:** solo se maneja loading/error de `movementsQuery`. Si `accountsQuery` (useManagementAccountsTree) o `canonicalQuery` fallan, `accountOptions` queda `[]` y, como `management_account_id` es obligatorio para clasificar, el usuario ve un drawer sin cuentas + el mensaje engañoso "Elige una categoría de gestión" cuando no hay ninguna. El error se traga sin señal.
- **⚠️ Relevante AHORA:** la raíz es el mismo bug que ya documentamos — `GET /api/management/accounts/tree` **tira 500** (ver [`../backend-contracts/management-accounts-tree-500-2026-05-30.md`](../backend-contracts/management-accounts-tree-500-2026-05-30.md)). Con `bankMovementClassification` activo en prod, los usuarios de `/caja/por-clasificar` no pueden clasificar (sin opciones de cuenta) y no se les dice por qué.
- **Por qué lo DIFIERO:** es cambio de comportamiento en pantalla LIVE + la raíz real es el 500 del backend (CC-API). **Recomendación:** prioridad = que CC-API arregle el 500 (#1 del bug doc). Como mitigación FE opcional, surfacear `accountsQuery.isError` con un banner o deshabilitar "Clasificar" con mensaje específico — decímelo y lo hago.
- **✅ RESUELTO (2026-06-01, autorizado):** se surfacea `accountsQuery.isError` con un `QavanteInlineError` ("las cuentas de gestión — no vas a poder clasificar hasta resolverlo") y se **deshabilita "Clasificar"** mientras las cuentas estén en error → no más drawer inútil con el error tragado. + story `CuentasConError`. (La raíz del 500 sigue siendo backend.)

---

_Generado por CC-WEB. Los 5 fixes autónomos (voseo/nombre/a11y) ya están en `main` (#244)._
