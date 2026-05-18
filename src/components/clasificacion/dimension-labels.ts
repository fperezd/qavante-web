/* Labels humanos para metadata de vistas de gestión (dimensiones). Puro y
 * testeable — traduce los enums técnicos del backend a lenguaje de negocio
 * (Anexo F). No se muestran nombres técnicos al usuario (addendum §8). */
import type { ManagementDimension } from "@/lib/api/management";

type DataType = ManagementDimension["data_type"];

const DATA_TYPE_LABEL: Record<DataType, string> = {
  text: "Texto",
  number: "Número",
  date: "Fecha",
  boolean: "Sí / No",
  currency: "Monto",
  percentage: "Porcentaje",
  reference: "Referencia",
};

/** Tipo de dato de la vista en lenguaje humano. Fallback defensivo. */
export function dimensionTypeLabel(dataType: string): string {
  return DATA_TYPE_LABEL[dataType as DataType] ?? "Texto";
}

/** "Obligatoria" | "Opcional" según `is_required`. */
export function dimensionRequirementLabel(isRequired: boolean): string {
  return isRequired ? "Obligatoria" : "Opcional";
}
