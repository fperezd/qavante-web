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
import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

export type EmployeesListResponse = components["schemas"]["EmployeesListResponse"];
export type EmployeeDetailResponse = components["schemas"]["EmployeeDetailResponse"];
export type PayrollResponse = components["schemas"]["PayrollResponse"];
export type PayrollTotales = components["schemas"]["PayrollTotales"];
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
        `/api/buk/employees/${employeeId}${opts?.full ? "?full=true" : ""}`,
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
      api.get<PayrollResponse>(`/api/buk/payroll?period=${encodeURIComponent(params.period)}`),
    enabled: Boolean(params.period),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}
