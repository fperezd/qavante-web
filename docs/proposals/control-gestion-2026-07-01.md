# Propuestas de UX — Revisión de Control de Gestión (2026-07-01)

Revisión integral de las 27 pantallas de Qavante con lente de **gerente de control
de gestión (CFO/controller)**, y 9 prototipos clickeables en Storybook. Todos los
prototipos son **presentacionales, aislados y NO cableados a las rutas** → cero
impacto en producción. Son propuestas para validar la UX antes de decidir qué se
implementa.

## Cómo verlo

```bash
git checkout proposals/all-control-gestion
npm run storybook
```

En Storybook, navegar el grupo **`Propuestas / …`** (y `Capa 2 / Impuestos / F29 Panel`).

## Los 9 prototipos

| # | Área | Prototipo | Storybook | PR | Feasibility |
|---|------|-----------|-----------|-----|-------------|
| 1 | Impuestos | **Panel anual F29** (semáforo + KPIs + tendencia + cuadratura + postergación) | `Capa 2 / Impuestos / F29 Panel` | #362 | requiere-backend (endpoint anual) |
| 2 | Caja | **Cockpit de Caja** (saldo hoy + runway + alerta de quiebre + saldo por cuenta) | `Propuestas / Caja / Cockpit de Caja` | #364 | **FE-only** (datos ya expuestos) |
| 3 | Caja | **Proyección v2** (saldo acumulado + línea de caja mínima + marcado de quiebre) | `Propuestas / Caja / Proyección v2` | #365 | **FE-only** |
| 4 | Cobrar | **Cobrar v2** (DSO + proyección de cobranza semanal + priorización + concentración) | `Propuestas / Cobrar / Cobrar v2` | #366 | mixto |
| 5 | Pagar | **Pagar v2** (vencido + subtotales por criticidad + delta de caja + por proveedor) | `Propuestas / Pagar / Pagar v2` | #367 | **FE-only** (mayormente) |
| 6 | SII | **Panel KPIs del Libro** (KPIs + concentración + netear NC + export CSV) | `Propuestas / SII / Libro KPIs` | #368 | **FE-only** |
| 7 | SII | **BHE v2** (retención como KPI + CTA F29 + concentración) | `Propuestas / SII / BHE v2` | #369 | **FE-only** (mayormente) |
| 8 | Inicio | **Inicio Ejecutivo v2** (runway héroe + deltas + sparkline + fechas clave) | `Propuestas / Inicio / Inicio Ejecutivo v2` | #370 | **FE-only** (mayormente) |
| 9 | Clasificación | **Por clasificar v2** (progreso + orden por monto + bulk + sugerencia+confianza) | `Propuestas / Clasificación / Por clasificar v2` | #371 | mixto |
| 10 | Transversal | **Tabla dinámica** (ordenar + filtrar + reordenar columnas por drag) | `Propuestas / Tablas dinámicas / Data-grid` | #373 | **FE-only** |

> **Tabla dinámica (#373):** capacidad reutilizable sobre `@tanstack/react-table` (ya en deps)
> — ordenar al clic, filtrar por columna y **reordenar columnas arrastrando el título**. Se
> puede adoptar como la tabla base de Cobrar / Pagar / Caja / Libros / Clasificación (siguiente
> paso si a Fernando le cierra la UX).

## Hallazgo transversal más importante

**Mucho de esto es "destrabar > construir".** El backend ya expone contratos que las
pantallas NO consumen:
- `CashToday`, `CashForecast.days_of_cash` (runway), `CashGap` (quiebre) → Cockpit de Caja
  y Proyección v2 son **FE-only**.
- `DashboardSummaryV2` (`key_obligations`, `cash_sparkline`, `cash_delta_pct`) ya definidos
  pero no renderizados → Inicio v2 es **FE-only**.
- Toda la lectura de negocio de los Libros (KPIs, concentración, netear NC, CSV) es
  **FE-only** sobre documentos ya descargados.

## Diagnóstico por área (resumen)

- **Inicio:** buena estructura, pero muestra niveles sin **deltas** — el dueño quiere saber
  si mejoró o empeoró. Falta ventas del mes vs año anterior y runway como héroe.
- **Caja:** el home es un menú sin datos; la proyección es una tabla contable, no una
  proyección de tesorería (falta saldo acumulado + quiebre). Ambos destrababiles hoy.
- **Cobrar:** buen tablero descriptivo, falta lo prescriptivo — DSO, proyección de cobranza
  (cash-in), priorización de gestión y concentración.
- **Pagar:** listado plano; falta bucket de vencidos, criticidad con subtotales, delta de
  caja explícito y agrupación por proveedor.
- **Impuestos/F29:** el "cajón de folio" no es pro; el panel anual con semáforo lo reemplaza.
- **Honorarios/BHE:** la retención (plata que se entera al SII) está como nota al pie, no como
  número de control.
- **Clasificación:** clasificar de a uno no escala; falta bulk, sugerencia+confianza y % de
  progreso (el KPI de salud de datos).

## Brechas de backend a levantar con CC-API (para lo que NO es FE-only)

1. **Cuentas por cobrar:** ampliar `accounts-receivable` con `dso` (+ serie histórica) y
   **bucketing de vencimientos futuros** (proyección de cobranza semanal). [Cobrar v2]
2. **Inicio:** `ventas_del_mes` con comparativa **YoY** a nivel top-level del summary. [Inicio v2]
3. **F29:** endpoint anual `GET /api/sii/f29?anio=YYYY` con estado de pago, vencimiento e IVA
   postergado (ya escalado en qavante-api#408). [F29 panel]
4. **BHE:** retención **acumulada multi-período** (mes/año) sin N fetches. [BHE v2]
5. **Clasificación:** endpoint **bulk-classify** (batch) + **sugerencia por movimiento**
   (`suggested_account` + `confidence`) + endpoint de **stats** (% clasificado, filtros
   server-side por período). [Por clasificar v2]
6. **Pagar:** `criticality_reason` por ítem (rationale del orden). [Pagar v2]

## Nota

Estos PRs quedan **abiertos para revisión** (no auto-merge): son propuestas. Fernando decide
cuáles avanzar; al aprobar uno, se cablea a su ruta (reemplazando los tipos provisionales por
los generados) y se activa por flag.
