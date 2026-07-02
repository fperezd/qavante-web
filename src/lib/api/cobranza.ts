import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

/* Capa de datos — Cobrar / Cuentas por cobrar (Sprint C4, Documento Maestro
   §7.3).

   `GET /api/treasury/accounts-receivable` YA existe en el backend (cookie-ready)
   y el flag `accountsReceivable` está ON en prod. Cuando el devengado
   (treasury.receivables, poblado por `sync-rcv`) está vacío, el backend devuelve
   honesto `data_state:"partial"` + `missing_sources` (ADR-0055 F1) en vez de un
   $0 confiado → la UI muestra "sincronización pendiente".

   Montos como string-decimal (igual que el resto del API treasury). */

/** Antigüedad de saldos (aging) — montos string-decimal CLP. */
export interface ReceivableAging {
  /** Vigente (no vencido). */
  current: string;
  d1_30: string;
  d31_60: string;
  d61_90: string;
  /** 90+ días. */
  d90_plus: string;
}

export interface TopDebtor {
  name: string;
  rut: string;
  total: string;
  overdue: string;
}

export interface OverdueDocument {
  client_name: string;
  client_rut: string;
  /** Tipo + folio en lenguaje humano (ej. "Factura 1234"). */
  document: string;
  /** Fecha de vencimiento (ISO date "YYYY-MM-DD"). */
  due_date: string;
  amount: string;
  /** Saldo pendiente (≤ amount). */
  balance: string;
  days_overdue: number;
}

export interface AccountsReceivableResponse {
  /** Total por cobrar. */
  total: string;
  /** Total vencido. */
  overdue: string;
  /** % vencido sobre el total (string-decimal, ej. "32.0"). */
  overdue_pct: string;
  aging: ReceivableAging;
  top_debtors: TopDebtor[];
  overdue_documents: OverdueDocument[];
  confidence: "high" | "medium" | "low";
  data_state: "available" | "partial" | "estimated";
  /** Fuentes que faltan para completar el dato (ej. "Sincronización SII
   *  pendiente", "Conectar SII"). Vacío/ausente cuando el dato está completo. */
  missing_sources?: string[];
  generated_at: string;
}

export const cobranzaKeys = {
  all: ["cobranza"] as const,
  accountsReceivable: () => [...cobranzaKeys.all, "accounts-receivable"] as const,
};

/** `GET /api/treasury/accounts-receivable` — snapshot actual de cuentas por
 *  cobrar. NO retry. */
export function useAccountsReceivable() {
  return useQuery({
    queryKey: cobranzaKeys.accountsReceivable(),
    queryFn: () => api.get<AccountsReceivableResponse>("/api/treasury/accounts-receivable"),
    staleTime: 30_000,
    retry: false,
  });
}
