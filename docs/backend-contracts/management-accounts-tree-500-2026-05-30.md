# Bug backend — `GET /api/management/accounts/tree` 500 + los 500 salen sin CORS (CC-WEB → CC-API)

> ## ✅ RESUELTO — 2026-05-31
>
> CC-API arregló el 500 de `GET /api/management/accounts/tree` (verificado
> end-to-end por CC-API). El flag `managementAccounts` se **reactivó** en
> `wrangler.toml` → `/administracion/estructura-gestion` queda LIVE (4/4
> pantallas de tesorería activas). Sanity-check FE: el endpoint devuelve
> `401 no_session` **con** headers CORS (el path de error ya no los pierde).
> Lo de abajo queda como histórico del incidente.

> Hallado el **2026-05-30** activando en prod las 4 pantallas de tesorería
> desbloqueadas por ADR-0027 (ver [`docs/operations/treasury-c3-activation-2026-05-30.md`](../operations/treasury-c3-activation-2026-05-30.md)).
> **3/4 funcionaron** (`/caja/proyeccion`, `/caja/por-clasificar`+`/clasificados`,
> `/administracion/reglas-clasificacion`). **Falla `/administracion/estructura-gestion`.**
>
> El FE está correcto (mismo cliente HTTP que las 3 que andan). Son **2 bugs de backend**.

## Evidencia (DevTools de Fernando, prod, sesión válida)

```
GET https://api.qavante.com/api/management/accounts/tree
    net::ERR_FAILED 500 (Internal Server Error)
Access to fetch at '…/api/management/accounts/tree' from origin
    'https://app.qavante.com' has been blocked by CORS policy:
    No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

Contraste con `curl` sin sesión (el endpoint + CORS funcionan en el happy/401 path):

```
$ curl -i https://api.qavante.com/api/management/accounts/tree -H "Origin: https://app.qavante.com"
HTTP/1.1 401 Unauthorized
access-control-allow-origin: https://app.qavante.com   ← el 401 SÍ trae CORS
access-control-allow-credentials: true
```

## Bug 1 (raíz) — el endpoint 500 en el path autenticado

`GET /api/management/accounts/tree` devuelve **500** cuando llega con sesión válida
del tenant real de Fernando (sin sesión devuelve 401 limpio). El handler revienta.

**Para CC-API:** revisar el traceback en los logs de Fly (`fly logs -a tooxs-gestion-api`)
filtrando por `accounts/tree`. Repro server-side sin browser:

```
curl -i https://api.qavante.com/api/management/accounts/tree -H "X-Api-Key: <key del tenant>"
```

Hipótesis a chequear (desde el FE no podemos ver el código): la query del árbol
es recursiva/anidada por `sort_order` — posible dato sembrado problemático para
ese tenant (cycle, `sort_order` null, `parent_id` colgado), o un issue de RLS en
la query del árbol. Las otras tablas de tesorería (cash-flow, classification-rules,
bank-movements) **no** fallan → es específico de `management.accounts` tree.

## Bug 2 (sistémico) — los 500 pierden los headers CORS

El response 500 **no** incluye `Access-Control-Allow-Origin`, así que el browser lo
**bloquea** y el `fetch` del FE muere como `ERR_FAILED` (red). Resultado: el usuario
ve "Parece que perdiste conexión. Verifica tu internet." en vez de un error de
servidor real — **para CUALQUIER 500**, no solo este endpoint.

**Causa probable (patrón FastAPI/Starlette):** `ServerErrorMiddleware` (el más
externo) atrapa la excepción no manejada y devuelve un 500 "pelado" **antes** de
que `CORSMiddleware` (más interno) agregue los headers. Por eso el 401 (respuesta
manejada, pasó por CORS) sí trae headers y el 500 no.

**Fix sugerido para CC-API** (mejora la UX de error de TODO el FE):

- Asegurar que las respuestas de error lleven CORS. Opciones: registrar un
  `exception_handler(Exception)` que construya el 500 con los headers CORS, o
  revisar el orden de middlewares para que CORS envuelva a ServerError, o usar el
  patrón de Starlette de CORS en `exception_handlers`.
- Con esto, un futuro 500 se mostraría como "No pudimos cargar la información.
  Intenta nuevamente." (copy de 5xx del Anexo C.3) en vez de "perdiste conexión".

## Estado del FE

- **Sin cambios de código necesarios.** El FE cablea bien (`useManagementAccountsTree`
  → `GET /api/management/accounts/tree`, mismo `api` client que las 3 pantallas OK).
- **Mitigación aplicada:** `NEXT_PUBLIC_FF_MANAGEMENT_ACCOUNTS=false` (kill-switch en
  Cloudflare) → la pantalla muestra el placeholder limpio hasta que CC-API arregle
  el Bug 1. Las otras 3 quedan activas.
- Reactivar el flag cuando CC-API confirme que `accounts/tree` devuelve 200 para el
  tenant real.

---

_Reportado por CC-WEB, 2026-05-30. Handoff para CC-API-A (vía Fernando / STATE_OF_THE_TRAIN)._
