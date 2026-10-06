import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

/* Lectura POR TRABAJADOR del ledger de evidencia D14 de remuneraciones (api#422 / #203).
   `GET /api/admin/treasury/payroll-worker-outstanding/{YYYYMM}`.

   Lo que distingue a este endpoint del board de conciliación
   (`/api/admin/treasury/payroll-settlements/{YYYYMM}`): el board cuenta la capa LEGADA —
   `paid_amount` sobre la liquidación— y ahí un trabajador puede figurar pagado porque alguien
   cerró el payable del mes, sin un solo enlace que lo respalde. Esta lectura cuenta **sólo**
   evidencia trazable: un trabajador sale `confirmed_paid` cuando una asignación individual
   colgada de un pago confirmado y vigente cubre su obligación sellada. Las cifras legadas
   viajan al lado, etiquetadas por lo que las respalda, para poder contrastarlas.

   El tipo sale del snapshot OpenAPI (`src/lib/api/types.ts`), no de una interfaz escrita a
   mano: hasta api#1093 esta respuesta salía al contrato como un objeto abierto
   (`additionalProperties: true`) y no había NADA tipado que consumir. Si el backend cambia la
   forma, `npm run contract:check` lo caza acá.

   Los montos llegan como `string`: son `Decimal` exactos del backend y se formatean con
   `formatMoneyFromDecimalString`, sin pasar por `number`. Un `null` en un monto NO es cero —
   significa que el período no tiene con qué nombrar esa cifra, y `abstention_reasons` dice por
   qué. */

export type PayrollWorkerOutstanding = components["schemas"]["PayrollWorkerOutstandingResponse"];

export type PayrollWorkerOutstandingWorker =
  components["schemas"]["PayrollWorkerOutstandingWorker"];

export const payrollEvidenceKeys = {
  all: ["payroll-evidence"] as const,
  workerOutstanding: (period: string) =>
    [...payrollEvidenceKeys.all, "worker-outstanding", period] as const,
  periodEvidence: (period: string) =>
    [...payrollEvidenceKeys.all, "period-evidence", period] as const,
};

/** Saldo por trabajador del período (`period` = YYYYMM). Owner/admin — degrada honesto si 403. */
export function usePayrollWorkerOutstanding(period: string, enabled = true) {
  return useQuery({
    queryKey: payrollEvidenceKeys.workerOutstanding(period),
    queryFn: () =>
      api.get<PayrollWorkerOutstanding>(
        `/api/admin/treasury/payroll-worker-outstanding/${encodeURIComponent(period)}`,
      ),
    enabled: enabled && Boolean(period),
  });
}

/* ───────────────────────────────────────────────────────────────────────────────────────────
   Lectura POR PERÍODO del mismo ledger D14: `GET /api/treasury/payroll-evidence/{YYYY-MM}`.

   Por qué hace falta ADEMÁS de la lectura por trabajador, que es lo que #203 todavía no tenía
   en pantalla: la lectura por trabajador cuenta sólo lo CONFIRMADO
   (`batch_allocated_amount` son lotes confirmados; `confirmed_paid_amount` son asignaciones
   colgadas de un pago confirmado). Un pago **observado y todavía no confirmado** no aparece en
   ninguna de sus cifras. En pantalla, entonces, un período con un pago observado por verificar
   se veía EXACTAMENTE igual que un período donde nadie pagó nada.

   Esta lectura publica esa categoría con nombre propio: `observed_payment_amount` y
   `state: "observed_unconfirmed"`. Es la segunda de las cinco separaciones que pide #203
   —obligación, pago observado por verificar, pago de lote confirmado, saldo y cobertura de la
   asignación— y la única que no estaba cableada.

   Dos diferencias con la lectura por trabajador que NO se pueden perder:

   1. **El período va en `YYYY-MM`, no en `YYYYMM`.** El contrato lo fija con el patrón
      `^\d{4}-(0[1-9]|1[0-2])$`. Pasarle el `YYYYMM` de la otra ruta da 422.
   2. **No es admin.** La lectura por trabajador vive bajo `/api/admin/` y un CFO sin rol admin
      recibe 403; ésta no, así que es la que puede ver cualquiera que entre a la pantalla.

   `confirmed_outstanding_amount` en `null` es abstención, no impago, y `allocation_coverage`
   dice aparte si lo asignado alcanza o no para nombrar a alguien. */

export type PayrollPeriodEvidence = components["schemas"]["PayrollPeriodEvidenceResponse"];

/** `YYYYMM` → `YYYY-MM`, que es el formato que exige esta ruta. Devuelve "" si no es un YYYYMM. */
export function yyyymmToDashedPeriod(yyyymm: string): string {
  return /^\d{6}$/.test(yyyymm) ? `${yyyymm.slice(0, 4)}-${yyyymm.slice(4, 6)}` : "";
}

/** Evidencia del período (`period` = `YYYY-MM`). Visible sin rol admin. */
export function usePayrollPeriodEvidence(period: string, enabled = true) {
  return useQuery({
    queryKey: payrollEvidenceKeys.periodEvidence(period),
    queryFn: () =>
      api.get<PayrollPeriodEvidence>(
        `/api/treasury/payroll-evidence/${encodeURIComponent(period)}`,
      ),
    enabled: enabled && Boolean(period),
  });
}
