# Contrato esperado — Pagar / Cuentas por pagar (Sprint C4)

> ✅ **Verificado 2026-06-21 (CC-WEB):** shape vigente, idéntico a los types del FE (`src/lib/api/pagos.ts`). Tramos `due_7d/14d/30d`, `category` ∈ supplier|tax|payroll|rent|debt|leasing|other. Construir contra esto — flip inmediato al exponerse.

> **CC-WEB → CC-API. 2026-06-02.** Contrato **FE-first**: el FE construyó la
> pantalla Pagar (`/pagar`, Maestro §7.4) contra este contrato + MSW, **gated
> por `accountsPayable` (OFF en prod)**. El endpoint **aún no existe**. Cuando
> CC-API lo exponga, corro `generate:api`, ajusto el adapter y activo el flag.
> Tipos hand-rolled en `src/lib/api/pagos.ts`. Par del C4 con
> `accounts-receivable` (Cobrar).

## Endpoint

`GET /api/treasury/accounts-payable`

- **Auth:** cookie `qavante_session`.
- Snapshot **actual**. **200** → `AccountsPayableResponse`. Sin datos → `items: []`
  - montos "0" (no se asume faltante = 0 silenciosamente, §13).

## Semántica (Maestro §7.4)

- "¿Qué debo pagar y qué es crítico?": total por pagar, próximos 7/14/30 días,
  pagos + obligaciones (IVA/F29, PPM, Previred, TGR, sueldos, arriendos, deuda,
  leasing) con criticidad y fuente, y la **relación contra caja** (si la caja
  proyectada cubre los pagos críticos).
- Montos string-decimal.

## Response shape

```jsonc
{
  "total": "12600000",
  "due_7d": "3800000",
  "due_14d": "6200000",
  "due_30d": "9100000",
  "items": [
    {
      "label": "IVA / F29 mayo",
      "category": "tax",
      "due_date": "2026-06-12",
      "amount": "2400000",
      "criticality": "high",
      "source": "SII",
    },
    {
      "label": "Sueldos junio",
      "category": "payroll",
      "due_date": "2026-06-30",
      "amount": "4200000",
      "criticality": "high",
      "source": "Previred",
    },
    {
      "label": "Proveedor Telefónica",
      "category": "supplier",
      "due_date": "2026-06-18",
      "amount": "890000",
      "criticality": "medium",
      "source": "SII",
    },
  ],
  "projected_cash_14d": "5400000", // o null
  "covers_critical": false, // o null — ¿la caja proyectada cubre lo crítico?
  "confidence": "high", // high | medium | low
  "data_state": "available", // available | partial | estimated
  "generated_at": "2026-06-02T12:00:00Z",
}
```

## Notas para CC-API

- `category` ∈ supplier | tax | payroll | rent | debt | leasing | other.
- `criticality` ∈ high | medium | low (el FE ordena críticos primero, luego por `due_date`).
- `covers_critical`: `true`/`false` si se pudo comparar caja proyectada vs pagos
  críticos; `null` si falta la proyección. El FE muestra una alerta cuando es `false`.
- Endpoint para el flag (FLAG_GATING_ENDPOINT): `/api/treasury/accounts-payable`.
