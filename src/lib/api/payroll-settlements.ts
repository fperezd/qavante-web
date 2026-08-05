import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { treasuryKeys } from "./treasury";

/* Conciliación de sueldos POR TRABAJADOR contra el banco (ADR-0073, #835). El backend es la
   ÚNICA fuente de verdad del estado conciliado (a diferencia del cruce por-monto que hacía el FE):
   - GET  /api/admin/treasury/payroll-settlements/{YYYYMM}  → board (trabajadores + links aplicados).
   - POST /api/admin/treasury/payroll-reconcile            → asignar (una-a-una o varias marcadas;
                                                              `dry_run:true` previsualiza sin mutar).
   - POST /api/admin/treasury/payroll-reconcile/revert     → desasignar un match por `link_id`.
   Endpoints `admin` (owner/admin). El board y la respuesta de reconcile son objetos genéricos en el
   OpenAPI (sin schema) → se tipan/normalizan en el FE (settlement-board-model.ts). */

/** Board crudo del backend (shape genérico; se normaliza en settlement-board-model). */
export type PayrollSettlementBoardRaw = unknown;

/** Cuerpo de POST reconcile. `worker_ruts` = asignación manual (uno = una-a-una; varios = varias
 *  marcadas). Sin `worker_ruts` el backend auto-sugiere por monto (con guard anti-Carrasco #826). */
export interface PayrollReconcileBody {
  period: string; // YYYYMM
  amount: number;
  bank_movement_id: string;
  worker_ruts: string[];
  dry_run: boolean;
}

export interface PayrollRevertBody {
  link_id: string;
}

export const payrollSettlementKeys = {
  all: ["payroll-settlements"] as const,
  board: (period: string) => [...payrollSettlementKeys.all, period] as const,
};

/** Board del período (`period` = YYYYMM). Owner/admin — degrada honesto si 403. */
export function usePayrollSettlementBoard(period: string, enabled = true) {
  return useQuery({
    queryKey: payrollSettlementKeys.board(period),
    queryFn: () =>
      api.get<PayrollSettlementBoardRaw>(
        `/api/admin/treasury/payroll-settlements/${encodeURIComponent(period)}`,
      ),
    enabled: enabled && Boolean(period),
  });
}

/** Al asignar/desasignar cambia el estado conciliado del período Y libera/ocupa débitos del banco →
 *  invalidamos el board y los movimientos bancarios (de donde salen los candidatos). */
function invalidateAfterReconcile(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: payrollSettlementKeys.all });
  qc.invalidateQueries({ queryKey: treasuryKeys.all });
}

/** Asigna un débito a uno o varios trabajadores. Con `dry_run:true` sólo previsualiza (no invalida
 *  ni muta): úsalo para validar antes de confirmar (el backend rechaza montos/movimientos inválidos). */
export function usePayrollReconcile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PayrollReconcileBody) =>
      api.post<unknown>(`/api/admin/treasury/payroll-reconcile`, { body }),
    onSuccess: (_data, body) => {
      if (!body.dry_run) invalidateAfterReconcile(qc);
    },
  });
}

/** Desasigna (deshace) un match ya aplicado por su `link_id`. Idempotente. */
export function usePayrollReconcileRevert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PayrollRevertBody) =>
      api.post<unknown>(`/api/admin/treasury/payroll-reconcile/revert`, { body }),
    onSuccess: () => invalidateAfterReconcile(qc),
  });
}
