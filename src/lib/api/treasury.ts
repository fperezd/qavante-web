/* Capa de datos — Treasury: canonical categories + movimientos bancarios
 * (listado + clasificación).
 *
 * Contrato VIVO (verificado 2026-05-18, regla 16): el addendum §17.3 estaba
 * equivocado — `classify` es **PATCH** (no POST) y `ClassifyMovementRequest`
 * NO lleva `dimension_assignments` (asignar dimensión = endpoint aparte).
 * Tipos del OpenAPI generado (`./types`), NUNCA hand-rolled (regla 3). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { classificationRulesKeys } from "./classification-rules";
import { treasuryReportsKeys } from "./treasury-reports";
import { obligationKeys } from "./obligations";
import { pagosKeys } from "./pagos";
import type { components } from "./types";

export type CanonicalCategoryMeta = components["schemas"]["CanonicalCategoryMeta"];
export type CanonicalCategoriesResponse = components["schemas"]["CanonicalCategoriesResponse"];
export type BankMovement = components["schemas"]["BankMovement"];
export type BankMovementsListResponse = components["schemas"]["BankMovementsListResponse"];
export type ClassifyMovementRequest = components["schemas"]["ClassifyMovementRequest"];
export type PayrollPaydayResponse = components["schemas"]["PayrollPaydayResponse"];
export type PutPayrollPaydayRequest = components["schemas"]["PutPayrollPaydayRequest"];
export type BankAccountItem = components["schemas"]["BankAccountItem"];
export type BankAccountsListResponse =
  components["schemas"]["app__core__treasury_schemas__BankAccountsListResponse"];

export interface BankMovementsParams {
  /** 'unclassified' | 'classified' | undefined (todos). */
  status?: string;
  /** Período YYYY-MM. */
  period?: string;
  limit?: number;
  offset?: number;
}

/* Query keys co-locados por dominio — patrón vigente del repo (`usersKeys` en
   users.ts), ratificado por ADR-0007 ("seguir el patrón existente"). */
export const treasuryKeys = {
  all: ["treasury"] as const,
  canonicalCategories: () => [...treasuryKeys.all, "canonical-categories"] as const,
  bankMovements: (params: BankMovementsParams = {}) =>
    [...treasuryKeys.all, "bank-movements", params] as const,
  bankAccounts: () => [...treasuryKeys.all, "bank-accounts"] as const,
  payrollPayday: () => [...treasuryKeys.all, "payroll-payday"] as const,
};

/** `GET /api/treasury/bank-accounts` — cuentas del tenant con su moneda. Para el
 *  selector de cuenta en Caja (no mezclar CLP/USD) y el formateo por moneda. */
export function useBankAccounts() {
  return useQuery({
    queryKey: treasuryKeys.bankAccounts(),
    queryFn: () => api.get<BankAccountsListResponse>("/api/treasury/bank-accounts"),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

/** `GET /api/treasury/canonical-categories` — metadata congelada (P4-4). */
export function useCanonicalCategories() {
  return useQuery({
    queryKey: treasuryKeys.canonicalCategories(),
    queryFn: () => api.get<CanonicalCategoriesResponse>("/api/treasury/canonical-categories"),
    staleTime: 60 * 60 * 1000, // 1 h: contrato congelado, no cambia en sesión
    retry: false,
  });
}

function buildBankMovementsQuery(p: BankMovementsParams): string {
  const s = new URLSearchParams();
  if (p.status) s.set("status", p.status);
  if (p.period) s.set("period", p.period);
  if (p.limit != null) s.set("limit", String(p.limit));
  if (p.offset != null) s.set("offset", String(p.offset));
  const qs = s.toString();
  return qs ? `?${qs}` : "";
}

/** `GET /api/bank-movements` — listado paginado (filtros status/period). */
export function useBankMovements(params: BankMovementsParams = {}) {
  return useQuery({
    queryKey: treasuryKeys.bankMovements(params),
    queryFn: () =>
      api.get<BankMovementsListResponse>(`/api/bank-movements${buildBankMovementsQuery(params)}`),
    staleTime: 30_000,
    retry: false,
  });
}

/** `PATCH /api/bank-movements/{id}/classify` — clasifica/reclasifica.
 *  `management_account_id` es obligatorio (422 si falta). Invalida los
 *  listados de movimientos al éxito. */
export function useClassifyBankMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ movementId, body }: { movementId: string; body: ClassifyMovementRequest }) =>
      api.patch<BankMovement>(`/api/bank-movements/${movementId}/classify`, { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: treasuryKeys.all });
      /* Clasificar con `create_rule:true` crea una regla, y SIEMPRE cambia los
         financial_impacts que alimentan el cash-flow report. Ambos viven en
         namespaces de query-key distintos (`classification-rules`,
         `treasury-reports`) que la invalidación de `treasury` no alcanza por
         prefijo → invalidarlos aparte (code-review #3). */
      qc.invalidateQueries({ queryKey: classificationRulesKeys.all });
      qc.invalidateQueries({ queryKey: treasuryReportsKeys.all });
    },
  });
}

/** `GET /api/treasury/payroll-payday` (ADR-0056) — día de pago de remuneraciones
 *  del tenant (1-31, o null = último día hábil). Define el vencimiento de la
 *  obligación "Remuneraciones" en Pagar. */
export function usePayrollPayday() {
  return useQuery({
    queryKey: treasuryKeys.payrollPayday(),
    queryFn: () => api.get<PayrollPaydayResponse>("/api/treasury/payroll-payday"),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

/** `PUT /api/treasury/payroll-payday` (owner/admin) — setea el día de pago
 *  (`payday_day` 1-31, o null para volver al default = último día hábil).
 *  Invalida el payday + las obligaciones (cambia el vencimiento de Remuneraciones). */
export function useSetPayrollPayday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PutPayrollPaydayRequest) =>
      api.put<PayrollPaydayResponse>("/api/treasury/payroll-payday", { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: treasuryKeys.payrollPayday() });
      // Cambiar el día de pago mueve el vencimiento de la obligación
      // "Remuneraciones" (treasury.payables) → refrescar accounts-payable.
      qc.invalidateQueries({ queryKey: pagosKeys.accountsPayable() });
      qc.invalidateQueries({ queryKey: obligationKeys.all });
    },
  });
}
