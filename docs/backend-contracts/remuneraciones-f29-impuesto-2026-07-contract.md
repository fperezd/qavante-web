# Remuneraciones (líquido por empleado) + F29 impuesto trabajadores — aviso CC-API → CC-WEB

**Fecha:** 2026-07-08 · **De:** CC-API · **Para:** CC-WEB

## TL;DR

Dos endpoints que hoy fallan/no traen dato **empiezan a funcionar** cuando Fernando
mergee + deployee estos PRs de backend. **No hay cambio de contrato OpenAPI** (no se
regeneró el snapshot, no hay campos nuevos ni cambios de shape) → **NO corras
`generate:api`**. Los tipos que ya tenés siguen válidos. El cambio es de **comportamiento**:
un 403 que desaparece y un `no_disponible` que pasa a traer valor real.

Gate: ambos van a prod cuando Fernando mergee **#542** y **#543** (los dos verdes) + auto-deploy a Fly.

---

## 1. `buk_payroll_detail` — deja de dar 403 al owner (PR #542, hallazgo H2)

**Endpoint:** `GET /api/buk/payroll/detail?period=YYYY-MM` (`operation_id: buk_payroll_detail`)
**Response model:** `PayrollDetailResponse` (sin cambios) — `status`, `period`, `empleados[]`
(`PayrollDetailEmployee`: `employee_id` / `nombre` / `rut` / `liquido`), `totales`
(`PayrollTotales`), `error`.

**Qué cambia:** este endpoint es `owner-only`. Hasta ahora, en el path de **sesión por
cookie** el backend no poblaba `role_code`, así que **el owner recibía 403** aunque fuera
dueño. H2 lo arregla: la sesión cookie ahora trae `role_code` → el owner recibe **200**.

**Qué hacer en el FE:**

- Las tabs **"Planilla por empleado"** y **"Conciliación"** (que ya consumen este endpoint)
  van a empezar a responder 200 con el líquido individual. Si tenías el feature oculto,
  con un fallback, o tragándote el 403 en silencio → **des-ocultalo / sacá el workaround**.
- Mantené el manejo de 403 **para no-owners** (un `viewer`/`admin` sigue recibiendo 403 acá,
  by design — es owner-only). El cambio es solo que **el owner ya no es un falso 403**.

## 2. `sii_f29_impuesto` — el impuesto de trabajadores pasa de `no_disponible` a real (PR #543)

**Endpoint:** `GET /api/sii/f29/impuesto?anio=&mes=` (`operation_id: sii_f29_impuesto`)
**Response model:** `F29ImpuestoResponse` (sin cambios) — incluye `impuesto_trabajadores: int`
y `fuente_impuesto_trabajadores: "manual" | "buk" | "no_disponible"`.

**Qué cambia:** la retención de impuesto único de 2ª categoría (código 48 del F29) salía de
BUK, pero el matcher de glosa buscaba variantes que no correspondían a la glosa real → daba
`fuente=no_disponible`, `impuesto_trabajadores=0` **en todos los meses** aunque BUK esté
conectado. Ahora matchea → con BUK conectado devuelve `fuente="buk"` y el monto real
(y el `total_con_iva` / `total_sin_iva` lo incluyen).

**Qué hacer en el FE:**

- Donde muestres el desglose del F29 / decisión de pagar-o-postergar: el impuesto de
  trabajadores va a dejar de aparecer en cero / "no disponible" para tenants con BUK.
- **Mantené los 3 estados** de `fuente_impuesto_trabajadores`:
  - `"buk"` → dato automático (mostrar el monto, badge "desde BUK").
  - `"manual"` → el usuario lo pasó por el query param `impuesto_trabajadores` (override).
  - `"no_disponible"` → sin BUK y sin override → seguí ofreciendo la **entrada manual**
    (no lo trates como $0 confirmado; es dato faltante).

---

## Nota (NO es FE): PR #540

#540 agrega `skipped_current_period: int` al response del endpoint de **push del histórico
BICE** (`bank_ingest_bice`, flujo de seed browser→prod). **No lo consume el FE**, es aditivo,
no cambia el snapshot. Lo menciono solo para cerrar el inventario — no hay nada que hacer acá.

---

## Checklist CC-WEB

- [ ] **No** regenerar tipos (no cambió el contrato).
- [ ] Owner: des-ocultar / verificar "Planilla por empleado" + "Conciliación" (ya no 403).
- [ ] F29: mostrar impuesto de trabajadores real cuando `fuente="buk"`; conservar los 3 estados.
- [ ] Esperar a que Fernando mergee #542 + #543 y deployee antes de dar por vivo el cambio.
