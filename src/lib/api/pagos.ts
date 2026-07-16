import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

/* Capa de datos — Pagar / Cuentas por pagar (Sprint C4, Documento Maestro
   §7.4).

   `GET /api/treasury/accounts-payable` YA existe en el backend. Igual que
   accounts-receivable (ADR-0055 F1): con el devengado (treasury.payables,
   poblado por `sync-rcv`) vacío devuelve honesto `data_state:"partial"` +
   `missing_sources` en vez de un $0 confiado. Gated por `accountsPayable`.

   Montos string-decimal (igual que el resto del API treasury). */

export type PaymentCategory =
  | "supplier"
  | "tax"
  | "payroll"
  | "rent"
  | "debt"
  | "leasing"
  | "other";

export interface PayableItem {
  /** Proveedor u obligación (ej. "Arriendo bodega", "IVA / F29"). */
  label: string;
  category: PaymentCategory;
  /** Fecha estimada de pago (ISO date "YYYY-MM-DD"). */
  due_date: string;
  amount: string;
  criticality: "high" | "medium" | "low";
  /** Fuente del dato en lenguaje humano (ej. "SII", "Previred", "Manual"). */
  source: string;
  /** Clave natural (ej. 'payroll-202606' → deriva el período para el detalle). */
  source_external_id?: string | null;
  /** Identidad de la contraparte (CC-WEB #2, nullables). Razón social del proveedor. */
  counterparty_name?: string | null;
  /** RUT de la contraparte con DV. Null en obligaciones sin RUT (nómina). */
  counterparty_rut?: string | null;
  /** Folio del DTE. Null cuando la obligación no es un DTE. */
  folio?: number | null;
  /** Código de tipo DTE del SII (33=Factura, 46=F.Compra, 61=NC…). Null si no aplica. */
  tipo_dte?: number | null;
  /** Moneda ISO del `amount`. Hoy siempre 'CLP' (USD vive en compras extranjeras). */
  currency?: string;
  /** `amount` en CLP cuando `currency` != CLP; null si ya es CLP. */
  amount_clp?: string | null;
  /** Monto estimado por el backend (ej. F29 del período en curso antes de que el SII lo emita;
   *  Previred proyectado). El FE lo muestra con el badge "Estimación" (fechas-clave-mes,
   *  vencimientos-timeline).
   *
   *  ⚠️ FE-first: **el backend NO manda este campo**. Verificado contra el openapi vivo de prod el
   *  16-07-2026 — `PayableItem` trae label, category, due_date, amount, criticality, source,
   *  source_external_id, counterparty_name, counterparty_rut, folio, tipo_dte, currency,
   *  amount_clp. No hay `estimated`. Como esta interfaz es hand-rolled, el compilador igual acepta
   *  `it.estimated`: llega `undefined` → `estimado: false` → **el badge nunca se ve en prod**.
   *
   *  No es un bug del FE: el cálculo del F29/Previred estimado está escalado a CC-API
   *  (STATE_OF_THE_TRAIN, 2026-07-14). El día que lo manden, el badge aparece solo. Antes decía
   *  "CC-API #TBD", que no apuntaba a nada. */
  estimated?: boolean;
}

/** Desglose crudo del total por moneda (sin convertir), para "(CLP $X + USD $Y)".
 *  CC-API #560. CLP primero. */
export interface PayableCurrencyTotal {
  currency: string;
  amount: string;
}

export interface AccountsPayableResponse {
  /** Total por pagar CONVERTIDO a CLP (TC vigente). Las monedas sin TC quedan
   *  fuera y se avisan en `missing_sources` (CC-API #560). */
  total: string;
  /** Desglose crudo por moneda (sin convertir) para mostrar "(CLP $X + USD $Y)"
   *  al lado del total. Ausente/1 sola moneda → no se muestra el desglose. */
  total_by_currency?: PayableCurrencyTotal[];
  /** Vence en los próximos 7 / 14 / 30 días (string-decimal). */
  due_7d: string;
  due_14d: string;
  due_30d: string;
  /** Pagos + obligaciones próximos (proveedores, IVA/PPM/Previred/TGR, sueldos,
   *  arriendos, deuda, leasing). OPCIONAL en el contrato: el backend lo omite en
   *  estado `partial` (devengado vacío) → la vista debe defaultear a []. */
  items?: PayableItem[];
  /** Caja proyectada a 14 días (del cash-flow) para la relación contra caja;
   *  `null` si no se pudo calcular. */
  projected_cash_14d: string | null;
  /** ¿La caja proyectada cubre los pagos críticos próximos? `null` si no se sabe. */
  covers_critical: boolean | null;
  confidence: "high" | "medium" | "low";
  data_state: "available" | "partial" | "estimated";
  /** Fuentes que faltan para completar el dato (ej. "Sincronización SII
   *  pendiente"). Vacío/ausente cuando el dato está completo. */
  missing_sources?: string[];
  generated_at: string;
}

export const pagosKeys = {
  all: ["pagos"] as const,
  accountsPayable: () => [...pagosKeys.all, "accounts-payable"] as const,
};

/** `GET /api/treasury/accounts-payable` — snapshot actual de cuentas por pagar.
 *  NO retry. */
export function useAccountsPayable() {
  return useQuery({
    queryKey: pagosKeys.accountsPayable(),
    queryFn: () => api.get<AccountsPayableResponse>("/api/treasury/accounts-payable"),
    staleTime: 30_000,
    retry: false,
  });
}
