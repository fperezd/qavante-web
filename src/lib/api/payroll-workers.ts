import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { gestionKeys } from "./gestion";
import type { components } from "./types";

/* Clasificación de remuneraciones por empleado (ADR-0079 v2, #743). Cada trabajador
   reparte su costo en una o varias cuentas del plan por % (`allocations`, Σ=100):
   `direct_cost.*` = costo de servicio (arriba del margen) · `operating_expense.*` =
   gasto (debajo). La asignación es FECHADA: rige desde `effective_from` (YYYY-MM)
   hacia adelante hasta la próxima. Sin clasificar cae en gasto admin por default →
   NO infla el margen; `unclassified_count` avisa. Cambia el Margen Bruto (100%
   falso → real); el resultado/EBITDA NO. */

export type WorkerClassification = components["schemas"]["WorkerClassification"];
export type PayrollWorkersResponse = components["schemas"]["PayrollWorkersResponse"];
export type AllocationOut = components["schemas"]["AllocationOut"];
/** Reparto a enviar: cuenta + %. El caso simple = 1 cuenta al 100%. */
export type AllocationIn = { account_code: string; pct: number };

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

/** Asigna/cambia el reparto de UN trabajador, efectivo desde `effectiveFrom` (YYYY-MM). */
export function useSetWorkerAllocations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      workerRut,
      allocations,
      effectiveFrom,
    }: {
      workerRut: string;
      allocations: AllocationIn[];
      effectiveFrom: string;
    }) =>
      api.put<WorkerClassification>(
        `/api/treasury/payroll-workers/${encodeURIComponent(workerRut)}/allocations`,
        { body: { allocations, effective_from: effectiveFrom } },
      ),
    onSuccess: () => invalidateAfterAssign(qc),
  });
}

/** Asigna el MISMO reparto a varios trabajadores, efectivo desde `effectiveFrom`. */
export function useBulkSetWorkerAllocations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      workerRuts,
      allocations,
      effectiveFrom,
    }: {
      workerRuts: string[];
      allocations: AllocationIn[];
      effectiveFrom: string;
    }) =>
      api.patch<{ updated: number } | unknown>(`/api/treasury/payroll-workers/allocations`, {
        body: { worker_ruts: workerRuts, allocations, effective_from: effectiveFrom },
      }),
    onSuccess: () => invalidateAfterAssign(qc),
  });
}
