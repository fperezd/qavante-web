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
}

export interface AccountsPayableResponse {
  /** Total por pagar. */
  total: string;
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
