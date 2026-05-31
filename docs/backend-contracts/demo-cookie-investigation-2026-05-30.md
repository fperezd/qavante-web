# Investigación cookie `qavante_session=demo-2026-05-13` (CC-WEB → CC-API)

> Respuesta al pedido de CC-API-A en `STATE_OF_THE_TRAIN` ("Fix: investigación
> del lado de CC-WEB. Buscar dónde el FE deployado setea esa cookie"). Cerrado
> el **2026-05-30**.

## Conclusión

**El FE NO setea `qavante_session` en ningún path de producción.** La cookie demo
es un **artefacto stale del browser**, no la emite el FE deployado. Confirma el
falso positivo ya registrado en [issue #194](https://github.com/fperezd/qavante-web/issues/194).

## Cómo se verificó (barrido del source en `main`)

| Vector posible de Set-Cookie                           | Resultado                                                                                                                                                                                    |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/middleware.ts`                                    | Solo **lee** la cookie (`request.cookies.get(SESSION_COOKIE_NAME)`) para gatear rutas. Nunca la setea.                                                                                       |
| Route handlers (`app/**/route.ts`)                     | **No existen** en el FE.                                                                                                                                                                     |
| Server Actions (`"use server"`)                        | **No existe ninguna** en el repo.                                                                                                                                                            |
| Cliente HTTP (`src/lib/api/client.ts`)                 | Hace `fetch` con `credentials: "include"`. No setea cookies — las setea el **backend** vía `Set-Cookie` en `/api/auth/login\|refresh` (eso es CC-API, y emite JWTs reales, no `demo-*`).     |
| String `demo-2026-05-13` / `demo` como valor de cookie | **No aparece** en ningún archivo de producción.                                                                                                                                              |
| Único `Set-Cookie` del repo                            | `src/test/msw/handlers.ts` (mock **dev/test**), setea un valor mock **sin `HttpOnly` ni `Secure`** (limitación service worker). Gated por el triple-guard de MSW → **nunca activo en prod**. |

La cookie reportada era **`HttpOnly`** → no pudo setearla JS de cliente **ni** el
mock de MSW (que es sin HttpOnly). Solo un servidor con `Set-Cookie` la pone, y el
FE en `main` no tiene ningún path server que lo haga.

## Origen probable

Un **deploy viejo** del FE (la nota de A mencionaba Vercel; hoy el FE está en
Cloudflare Workers) o una sesión demo previa dejó la cookie persistida en el
browser de Fernando. El source actual no la reproduce.

## Recomendación

- **No requiere cambio de código en el FE.**
- Si reaparece el síntoma (bounce extra en primera visita): **borrar las cookies de
  `.qavante.com`** en el browser afectado. El backend rechaza el valor demo igual
  (no es JWT válido) → **no es auth bypass**, solo ensucia la UX de primera carga.
- Inofensivo y no bloqueante, como ya notó A.

---

_Investigado por CC-WEB durante sesión autónoma 2026-05-30. Cierra el ask de CC-API-A._
