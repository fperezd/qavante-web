/* Capa de datos — Sistema de remuneraciones DECLARADO por la sociedad
   (CC-API ADR-0122, `GET`/`PUT /api/treasury/payroll-system`).

   Decisión del dueño (2026-10-01): el sistema de remuneraciones es una CONFIGURACIÓN
   DE LA EMPRESA, con tres opciones exactas — BUK, Talana, Manual. Se elige en el
   onboarding y se puede cambiar siempre en Configuración. Según lo elegido, Qavante
   activa el adaptador correspondiente o el flujo de carga manual.

   Dos cosas que esta capa NO hace, a propósito:

   1. **No infiere el sistema** desde qué credencial existe. Antes la UI deducía
      "tiene BUK" de `useBukHealth`; manda lo que la empresa declaró.
   2. **No completa `declared=false` con "BUK"**. Que la empresa todavía no haya
      elegido es un hecho distinto de que haya elegido BUK, y la pantalla lo dice.

   El grano es la EMPRESA ACTIVA del request (la manda el cliente en su header). Sin
   empresa activa la API responde 409 `missing_scope:legal_entity`: no existe una
   respuesta a nivel cuenta y la UI no la inventa.

   Tipos GENERADOS del OpenAPI (`./types`), nunca hand-rolled (regla 3). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

export type PayrollSystemResponse = components["schemas"]["PayrollSystemResponse"];
export type PayrollSystemEra = components["schemas"]["PayrollSystemEra"];
export type PutPayrollSystemRequest = components["schemas"]["PutPayrollSystemRequest"];

export const payrollSystemKeys = {
  all: ["payroll-system"] as const,
};

/** `GET /api/treasury/payroll-system` — sistema vigente de la empresa activa + su
 *  historia fechada. Sin retry: un 409 por falta de empresa activa no mejora
 *  reintentando, y la pantalla sabe explicarlo. */
export function usePayrollSystem() {
  return useQuery({
    queryKey: payrollSystemKeys.all,
    queryFn: () => api.get<PayrollSystemResponse>("/api/treasury/payroll-system"),
    staleTime: 60_000,
    retry: false,
  });
}

/** `PUT /api/treasury/payroll-system` — declara el sistema desde un período
 *  (`YYYYMM`). Owner/admin. El cuerpo NO lleva la empresa: la elige el scope del
 *  request, así que esta mutación no puede configurar otra empresa por accidente.
 *  La respuesta ya trae el estado nuevo completo → se escribe en la cache. */
export function useDeclarePayrollSystem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PutPayrollSystemRequest) =>
      api.put<PayrollSystemResponse>("/api/treasury/payroll-system", { body }),
    onSuccess: (res) => {
      qc.setQueryData(payrollSystemKeys.all, res);
    },
  });
}
