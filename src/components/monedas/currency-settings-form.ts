/* Schema + transforms del editor de Ajustes de Monedas (Addendum §15.4/§15.6).
   Vive aparte del dialog para mantenerse testeable sin renderizar UI — el
   proyecto vitest `unit` corre Node-puro, no jsdom (ver vitest.config.ts).

   Reglas de coherencia validadas cliente-side (UX); el backend re-valida
   y devuelve 422 ante inconsistencias residuales. No fabricamos: nos
   apoyamos en `UpdateCompanyCurrencySettingsRequest` del OpenAPI generado. */
import { z } from "zod";
import type {
  CompanyCurrencySettings,
  UpdateCompanyCurrencySettingsRequest,
} from "@/lib/api/currencies";

/* Fuentes de TC oficiales en Chile. No es enum cerrado del contrato (el
   campo del schema es string nullable), pero estas son las dos canónicas;
   "Sin preferencia" se traduce a `null`. */
export const FX_SOURCES = ["BCCH", "SII"] as const;

export const settingsSchema = z
  .object({
    functional_currency_code: z.string().min(1, "Elige la moneda funcional"),
    default_reporting_currency_code: z.string(),
    reporting_currency_codes: z.array(z.string()),
    indexed_unit_enabled: z.boolean(),
    indexed_unit_currency_code: z.string(),
    default_exchange_rate_source: z.string(),
  })
  .refine((data) => !data.reporting_currency_codes.includes(data.functional_currency_code), {
    message: "La moneda funcional no puede estar también como moneda de reporte.",
    path: ["reporting_currency_codes"],
  })
  .refine(
    (data) =>
      !data.default_reporting_currency_code ||
      data.reporting_currency_codes.includes(data.default_reporting_currency_code),
    {
      message: "La moneda de reporte por defecto debe estar entre las monedas de reporte.",
      path: ["default_reporting_currency_code"],
    },
  )
  .refine((data) => !data.indexed_unit_enabled || data.indexed_unit_currency_code !== "", {
    message: "Si activas la unidad indexada, tienes que elegir cuál.",
    path: ["indexed_unit_currency_code"],
  });

export type SettingsFormValues = z.infer<typeof settingsSchema>;

/** Snapshot de settings → valores iniciales del form. `null` = aún no
 *  sembrados (§15.4): default Chile (CLP funcional, sin reporting, sin UF). */
export function settingsToForm(s: CompanyCurrencySettings | null): SettingsFormValues {
  if (!s) {
    return {
      functional_currency_code: "CLP",
      default_reporting_currency_code: "",
      reporting_currency_codes: [],
      indexed_unit_enabled: false,
      indexed_unit_currency_code: "",
      default_exchange_rate_source: "",
    };
  }
  return {
    functional_currency_code: s.functional_currency_code,
    default_reporting_currency_code: s.default_reporting_currency_code ?? "",
    reporting_currency_codes: s.reporting_currency_codes ?? [],
    indexed_unit_enabled: s.indexed_unit_enabled,
    indexed_unit_currency_code: s.indexed_unit_currency_code ?? "",
    default_exchange_rate_source: s.default_exchange_rate_source ?? "",
  };
}

/** Form → body de PATCH. Strings vacíos → null (semántica "limpiar"); si
 *  indexed_unit_enabled=false, el code se manda null (resetea). */
export function formToRequest(values: SettingsFormValues): UpdateCompanyCurrencySettingsRequest {
  return {
    functional_currency_code: values.functional_currency_code,
    default_reporting_currency_code: values.default_reporting_currency_code || null,
    reporting_currency_codes: values.reporting_currency_codes,
    indexed_unit_enabled: values.indexed_unit_enabled,
    indexed_unit_currency_code: values.indexed_unit_enabled
      ? values.indexed_unit_currency_code || null
      : null,
    default_exchange_rate_source: values.default_exchange_rate_source || null,
  };
}
