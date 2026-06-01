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

/** Opciones {value,label} de `data_type` para el select del editor. */
export const DATA_TYPE_OPTIONS: ReadonlyArray<{ value: DataType; label: string }> = (
  Object.keys(DATA_TYPE_LABEL) as DataType[]
).map((value) => ({ value, label: DATA_TYPE_LABEL[value] }));

/** "Obligatoria" | "Opcional" según `is_required`. */
export function dimensionRequirementLabel(isRequired: boolean): string {
  return isRequired ? "Obligatoria" : "Opcional";
}
