# Contrato esperado — Cobrar / Cuentas por cobrar (Sprint C4)

> ✅ **Verificado 2026-06-21 (CC-WEB):** shape vigente, idéntico a los types del FE (`src/lib/api/cobranza.ts`). Claves de aging: `current/d1_30/d31_60/d61_90/d90_plus`. Construir contra esto — flip inmediato al exponerse.

> **CC-WEB → CC-API. 2026-06-02.** Contrato **FE-first**: el FE construyó la
> pantalla Cobrar (`/cobrar`, Maestro §7.3) contra este contrato + MSW, **gated
> por `accountsReceivable` (OFF en prod)**. El endpoint **aún no existe**.
> Cuando CC-API lo exponga con este shape, corro `generate:api`, ajusto el
> adapter si hace falta y activo el flag. Tipos hand-rolled en
> `src/lib/api/cobranza.ts`.

## Endpoint

`GET /api/treasury/accounts-receivable`

- **Auth:** cookie `qavante_session` (como tesorería C3 post-ADR-0027).
- Snapshot **actual** (sin params en v1; un futuro `as_of=YYYY-MM-DD` puede sumarse).
- **200** → `AccountsReceivableResponse`. Sin datos → arrays vacíos + montos "0"
  con `data_state` acorde (no se asume faltante = 0 silenciosamente, §13).

## Semántica (Maestro §7.3)

- "¿Quién me debe y qué cobrar primero?": total por cobrar, vencido, %vencido,
  antigüedad de saldos (aging), top deudores, documentos vencidos.
- Montos **string-decimal**. RUTs con formato chileno (el FE valida/formatea).
- Aging buckets: **vigente / 1-30 / 31-60 / 61-90 / 90+** días.

## Response shape

```jsonc
{
  "total": "24800000",
  "overdue": "7900000",
  "overdue_pct": "31.9",
  "aging": {
    "current": "16900000", // vigente (no vencido)
    "d1_30": "3200000",
    "d31_60": "2100000",
    "d61_90": "1400000",
    "d90_plus": "1200000",
  },
  "top_debtors": [
    {
      "name": "Constructora Andes SpA",
      "rut": "76.123.456-7",
      "total": "9800000",
      "overdue": "3200000",
    },
  ],
  "overdue_documents": [
    {
      "client_name": "Constructora Andes SpA",
      "client_rut": "76.123.456-7",
      "document": "Factura 1234",
      "due_date": "2026-05-10",
      "amount": "3200000",
      "balance": "3200000",
      "days_overdue": 23,
    },
  ],
  "confidence": "high", // high | medium | low
  "data_state": "available", // available | partial | estimated
  "generated_at": "2026-06-02T12:00:00Z",
}
```

## Notas para CC-API

- `overdue_pct` string-decimal (ej. `"31.9"`).
- `aging.*` suman ≈ `total` (vigente + vencidos por tramo).
- `days_overdue` entero (≥ 1 para documentos vencidos).
- `balance` ≤ `amount` (saldo pendiente del documento).
- Endpoint para el flag (FLAG_GATING_ENDPOINT): `/api/treasury/accounts-receivable`.
- Par del C4: `GET /api/treasury/accounts-payable` (Pagar) — mismo patrón, ver su contrato.
