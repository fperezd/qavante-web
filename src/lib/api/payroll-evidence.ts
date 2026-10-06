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
