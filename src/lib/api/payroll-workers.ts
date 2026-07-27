import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { gestionKeys } from "./gestion";
import type { components } from "./types";

/* Clasificación de remuneraciones por empleado (ADR-0079). Cada trabajador se
   asigna a una cuenta del plan: `direct_cost.*` = costo de servicio (arriba del
   margen) · `operating_expense.*` = gasto (debajo). Sin clasificar cae en gasto
   admin por default → NO infla el margen; `unclassified_count` avisa cuántos
   faltan. Cambia el Margen Bruto (100% falso → real); el resultado/EBITDA NO. */

export type WorkerClassification = components["schemas"]["WorkerClassification"];
export type PayrollWorkersResponse = components["schemas"]["PayrollWorkersResponse"];

export const payrollWorkersKeys = {
  all: ["payroll-workers"] as const,
  list: (period: string) => [...payrollWorkersKeys.all, period] as const,
};

export function usePayrollWorkers(period: string, enabled = true) {
  return useQuery({
    queryKey: payrollWorkersKeys.list(period),
    queryFn: () =>
      api.get<PayrollWorkersResponse>(
        `/api/treasury/payroll-workers?period=${encodeURIComponent(period)}`,
      ),
    enabled: enabled && Boolean(period),
  });
}

/* Al (re)clasificar, cambia el reparto costo/gasto → invalidamos el resultado
   operacional (Gestión) además de la propia lista. */
function invalidateAfterAssign(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: payrollWorkersKeys.all });
  qc.invalidateQueries({ queryKey: gestionKeys.all });
}

export function useSetWorkerAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workerRut, accountCode }: { workerRut: string; accountCode: string }) =>
      api.put<WorkerClassification>(
        `/api/treasury/payroll-workers/${encodeURIComponent(workerRut)}/account`,
        { body: { account_code: accountCode } },
      ),
    onSuccess: () => invalidateAfterAssign(qc),
  });
}

export function useBulkSetWorkerAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workerRuts, accountCode }: { workerRuts: string[]; accountCode: string }) =>
      api.patch<{ updated: number } | unknown>(`/api/treasury/payroll-workers/account`, {
        body: { worker_ruts: workerRuts, account_code: accountCode },
      }),
    onSuccess: () => invalidateAfterAssign(qc),
  });
}
