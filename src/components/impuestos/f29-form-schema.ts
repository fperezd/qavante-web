/* Schema + transforms del form de consulta F29 (Sprint C1).
   Vive aparte del view para mantenerse testeable sin renderizar UI — el
   proyecto vitest `unit` corre Node-puro, sin jsdom.
 *
 * Decisiones:
 * - El backend acepta `folio: number` en el path. La UX más natural es
 *   un input texto (folios SII suelen ser de 6-12 dígitos). El schema
 *   acepta string en el form (`folioInput`) y derivamos un `folio: number`
 *   parseado al submit. Esto evita el ruido de `<input type=number>` con
 *   spinners y wheel-scroll en mobile.
 * - Trimming defensivo: el usuario suele copy/paste con espacios al lado.
 * - Validación: número entero positivo, NO permitimos `0`, negativos ni
 *   decimales. El backend re-valida (422). */
import { z } from "zod";

export const f29FormSchema = z.object({
  folioInput: z
    .string()
    .trim()
    .min(1, "Ingresa el folio del F29 que quieres consultar.")
    .refine((v) => /^[0-9]+$/.test(v), {
      message: "El folio es un número entero (solo dígitos, sin espacios ni signos).",
    })
    .refine((v) => Number(v) > 0, {
      message: "El folio debe ser mayor a cero.",
    }),
});

export type F29FormValues = z.infer<typeof f29FormSchema>;

export const F29_FORM_DEFAULTS: F29FormValues = {
  folioInput: "",
};

/** Convierte el string validado a número para invocar `useSiiF29(folio)`. */
export function parseFolio(input: string): number {
  return Number(input.trim());
}
