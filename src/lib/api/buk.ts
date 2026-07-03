/* Capa de datos — BUK (proveedor de Remuneraciones / RRHH chileno). El backend
 * expone estos endpoints (verificado en el OpenAPI en vivo):
 *
 * - `GET /api/buk/health`                    → estado del conector (mode, reachable).
 * - `GET /api/buk/employees[?status&page&all_pages&full]` → dotación (slim por
 *     default: id, full_name, rut, email, gender, role).
 * - `GET /api/buk/employees/{employee_id}`   → detalle del empleado (slim; `?full`
 *     trae los 200+ campos crudos del BUK).
 * - `GET /api/buk/payroll?period=YYYY-MM`    → totales AGREGADOS de planilla. Por
 *     privacidad el backend NO expone detalle por empleado (solo agregados).
 *
 * Auth por cookie httpOnly `qavante_session` (mismo patrón que SII). Si BUK
 * sigue api-key-only en el backend, estos GET dan 401 hasta que CC-API lo
 * cookie-gatee — la UI lo surfacea con QavanteInlineError (regla 16).
 *
 * Tipos del OpenAPI generado (`./types`), NUNCA hand-rolled (regla 3). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { obligationKeys } from "./obligations";
import { pagosKeys } from "./pagos";
import type { components } from "./types";

export type EmployeesListResponse = components["schemas"]["EmployeesListResponse"];
export type EmployeeDetailResponse = components["schemas"]["EmployeeDetailResponse"];
export type PayrollResponse = components["schemas"]["PayrollResponse"];
export type PayrollTotales = components["schemas"]["PayrollTotales"];
export type PayrollSyncResponse = components["schemas"]["PayrollSyncResponse"];
export type BukHealthResponse = components["schemas"]["BukHealthResponse"];

export interface BukEmployeesParams {
  /** `undefined` = solo activos (default backend). `""` = incluir inactivos. */
  status?: string;
  /** Página (1-based) para paginación del BUK. */
  page?: number;
  /** `true` trae todas las páginas de una (usar con cuidado en dotaciones grandes). */
  allPages?: boolean;
  /** `true` devuelve todos los campos crudos del BUK (response grande). */
  full?: boolean;
}

export interface BukPayrollParams {
  /** Período `YYYY-MM` (ej. `2026-03`). */
  period: string;
  /** `true` pide el detalle por empleado (líquido) para conciliación bancaria.
   *  Contrato FE-first: CC-API extiende el payroll con `detalle` gated owner/admin
   *  (escalado por STATE). Si el backend lo ignora, el detalle no viene y listo. */
  detalle?: boolean;
}

export const bukKeys = {
  all: ["buk"] as const,
  health: () => [...bukKeys.all, "health"] as const,
  employees: (params: BukEmployeesParams) => [...bukKeys.all, "employees", params] as const,
  employee: (id: string, full?: boolean) =>
    [...bukKeys.all, "employee", id, { full: Boolean(full) }] as const,
  payroll: (params: BukPayrollParams) => [...bukKeys.all, "payroll", params] as const,
};

/** Construye el query string de `/api/buk/employees` a partir de los params.
 *  Puro/exportado para testear. Devuelve "" cuando no hay params. */
export function buildEmployeesQuery(params: BukEmployeesParams): string {
  const qs = new URLSearchParams();
  if (params.status !== undefined) qs.set("status", params.status);
  if (params.page != null) qs.set("page", String(params.page));
  if (params.allPages) qs.set("all_pages", "true");
  if (params.full) qs.set("full", "true");
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/** `GET /api/buk/health` — estado del conector BUK (mode: starter/direct,
 *  reachable). Útil para gating UI antes de pedir dotación/planilla. */
export function useBukHealth() {
  return useQuery({
    queryKey: bukKeys.health(),
    queryFn: () => api.get<BukHealthResponse>("/api/buk/health"),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/** `GET /api/buk/employees` — dotación (slim por default). */
export function useBukEmployees(params: BukEmployeesParams = {}) {
  return useQuery({
    queryKey: bukKeys.employees(params),
    queryFn: () =>
      api.get<EmployeesListResponse>(`/api/buk/employees${buildEmployeesQuery(params)}`),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

/** `GET /api/buk/employees/{id}` — detalle del empleado. `full` trae todos los
 *  campos crudos del BUK. Solo corre con un `employeeId` no nulo. */
export function useBukEmployee(employeeId: string | null, opts?: { full?: boolean }) {
  return useQuery({
    queryKey: bukKeys.employee(employeeId ?? "", opts?.full),
    queryFn: () =>
      api.get<EmployeeDetailResponse>(
        `/api/buk/employees/${encodeURIComponent(employeeId ?? "")}${opts?.full ? "?full=true" : ""}`,
      ),
    enabled: Boolean(employeeId),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

/** `GET /api/buk/payroll?period=YYYY-MM` — totales agregados de planilla del
 *  período (sin detalle por empleado, por privacidad). Solo corre con período. */
export function useBukPayroll(params: BukPayrollParams) {
  return useQuery({
    queryKey: bukKeys.payroll(params),
    queryFn: () =>
      api.get<PayrollResponse>(
        `/api/buk/payroll?period=${encodeURIComponent(params.period)}${
          params.detalle ? "&detalle=true" : ""
        }`,
      ),
    enabled: Boolean(params.period),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

/** `POST /api/buk/sync-payroll?period=YYYY-MM` (ADR-0056) — trae el líquido total
 *  de BUK del período y lo persiste como una obligación "Remuneraciones" en Pagar
 *  (`treasury.payables`, con vencimiento = día de pago). Idempotente por período.
 *  Owner/admin. Invalida la planilla + las obligaciones para reflejar la nueva
 *  cuenta por pagar. NO retry (es una acción explícita del usuario). */
export function useSyncBukPayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (period: string) =>
      api.post<PayrollSyncResponse>(
        `/api/buk/sync-payroll?period=${encodeURIComponent(period)}`,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bukKeys.all });
      // La obligación "Remuneraciones" vive en treasury.payables → la sirve
      // accounts-payable (namespace `pagos`), NO obligations (préstamos). Sin
      // esto, el total de Pagar queda stale tras registrar la planilla.
      qc.invalidateQueries({ queryKey: pagosKeys.accountsPayable() });
      qc.invalidateQueries({ queryKey: obligationKeys.all });
    },
  });
}
