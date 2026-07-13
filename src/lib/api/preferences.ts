import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

/* Capa de datos — Preferencias de UI del usuario en la empresa activa
   (`/api/me/preferences`, CC-API #571). Blob OPACO por diseño: el backend no
   interpreta el contenido, solo lo guarda por (usuario × empresa). El FE define
   las claves (ej. `inicio_widget_order`). Tipos GENERADOS (regla 3).

   Contrato CLAVE: el PUT REEMPLAZA el blob completo (no hace merge). Por eso el
   caller debe leer el blob actual y mandar el superset — ver `withWidgetOrder`
   en `components/inicio/v2/widget-order.ts`. Si el GET falló, NO se debe persistir
   (se pisaría el resto de las prefs con un blob parcial). */

export type PreferencesResponse = components["schemas"]["PreferencesResponse"];
export type PreferencesBlob = PreferencesResponse["preferences"];

export const preferencesKeys = {
  all: ["preferences"] as const,
};

/** `GET /api/me/preferences` — blob de prefs de UI. NO retry (degrada solo: sin
 *  prefs, la UI usa sus defaults). */
export function usePreferences() {
  return useQuery({
    queryKey: preferencesKeys.all,
    queryFn: () => api.get<PreferencesResponse>("/api/me/preferences"),
    staleTime: 60_000,
    retry: false,
  });
}

/** `PUT /api/me/preferences` — reemplaza el blob completo. El caller arma el blob
 *  entero; esta mutación solo lo manda y refresca la cache con la respuesta. */
export function useUpdatePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (preferences: PreferencesBlob) =>
      api.put<PreferencesResponse>("/api/me/preferences", { body: { preferences } }),
    onSuccess: (res) => {
      qc.setQueryData(preferencesKeys.all, res);
    },
  });
}
