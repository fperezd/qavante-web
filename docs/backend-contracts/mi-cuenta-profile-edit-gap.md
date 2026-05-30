# Brecha backend — Editar perfil propio desde Mi cuenta (CC-WEB → CC-API)

> Documento de **necesidad** del frontend `qavante-web`. No es un contrato cerrado —
> es un brief para que CC-API + Fernando decidan el shape óptimo del endpoint.
>
> **Estado al escribir** (2026-05-30): la pantalla `/mi-cuenta`
> ([PR #213](https://github.com/fperezd/qavante-web/pull/213)) está cableada en
> modo **solo lectura** bajo el flag `miCuenta` (default OFF). Muestra nombre,
> correo, empresa, rol y último ingreso consumiendo `GET /api/me`, y permite
> **cerrar sesión** (`POST /api/auth/logout`). No hay edición de perfil porque el
> backend no expone un endpoint de auto-edición.

---

## La brecha

Auditoría del OpenAPI (`src/lib/api/types.ts`) al 2026-05-30:

- **`/api/me`** declara **solo `get`** (put/post/patch/delete = `never`).
- **`PATCH /api/users/{user_id}`** existe, pero es **gestión admin**: su body es
  `{ role?, status? }` (no `name`) y la matriz de roles (Anexo C.4) lo restringe a
  `owner`/`admin`/`technical_admin`. No sirve para que un usuario edite su **propio**
  perfil (ni expone `name`).
- No existe `/api/account`, `/api/profile` ni `PATCH /api/me`.

**Resultado:** cualquier usuario autenticado (incluido `viewer`) que quiera corregir
su nombre no tiene cómo. El campo `name` de `MeUser` es `string | null`; hoy se
setea en el flujo de invitación (`accept-invitation`) y nunca más se puede cambiar
desde el producto.

## Lo que el FE necesita

Un endpoint para que el **usuario logueado edite su propio perfil**, con cookie auth
(no X-Api-Key — ver Brecha 0 en [`c3-treasury-reports-gaps.md`](./c3-treasury-reports-gaps.md);
`/api/me` ya acepta cookie, idealmente este endpoint también).

### Shape sugerido (no cerrado)

```
PATCH /api/me
  body: { "name": string }          # trim server-side; rechazar vacío/solo-espacios
  200 → MeResponse                  # el mismo shape que GET /api/me, ya actualizado
  # o 204 No Content y el FE invalida la query ["users","me"]
```

- **Permisos:** cualquier rol autenticado edita lo suyo. Sin gate de rol.
- **Campos:** arrancar con `name` solamente (bajo riesgo). **`email` queda fuera de
  scope** de esta brecha: cambiar correo implica re-verificación / impacto en login y
  amerita su propio flujo (handoff aparte). **Clave** ya tiene su propio camino
  (recuperación); no va acá.
- **Validación:** `name` no vacío tras `trim`; largo máximo razonable (ej. 120).
  Devolver `422 { code, detail }` en error de validación (el FE ya mapea `ApiError`
  → copy del Anexo C.3).

## Qué hace el FE cuando exista

1. `npm run generate:api` regenera `types.ts` con `PATCH /api/me`.
2. Se agrega `useUpdateMe()` en `src/lib/api/users.ts` (mutación + `invalidateQueries`
   sobre `usersKeys.me()`).
3. La pantalla `/mi-cuenta` suma un modo edición del campo nombre (form mínimo,
   patrón de los diálogos/forms existentes), bajo el mismo flag `miCuenta`.

Sin endpoint, el FE **no inventa** persistencia local ni edición fake (regla 5 +
patrón "MVP honesto" [ADR-0013](../adr/0013-treasury-reports-mvp-honest-no-invention.md)).

---

_Generado por CC-WEB durante sesión autónoma Modo A ([ADR-0014](../adr/0014-sesiones-autonomas-low-risk.md)), 2026-05-30._
