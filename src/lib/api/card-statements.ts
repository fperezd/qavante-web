import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { treasuryKeys } from "./treasury";
import type { components } from "./types";

/* Capa de datos — Cartola de tarjeta (importación). El usuario sube el PDF de la
   cartola BICE (nacional o internacional) y el backend extrae compras al
   extranjero, pago detectado y cargos. `POST /api/treasury/card-statements/import`
   (multipart/form-data, cookie de sesión — verificado 2026-06-28). Tipos
   generados (regla 3). Montos string-decimal. */

export type CardStatementImportResponse = components["schemas"]["CardStatementImportResponse"];

/** `POST /api/treasury/card-statements/import` — sube el PDF de la cartola.
    multipart/form-data con campo `file`. Devuelve el resumen de lo extraído.
    Invalida las queries de obligaciones y compras al extranjero. NO retry. */
export function useImportCardStatement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.post<CardStatementImportResponse>("/api/treasury/card-statements/import", {
        body: form,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obligations"] });
      qc.invalidateQueries({ queryKey: ["foreign-purchases"] });
      // `["bank-movements"]` no matchea la query real `["treasury","bank-movements",…]`.
      qc.invalidateQueries({ queryKey: treasuryKeys.all });
    },
  });
}
