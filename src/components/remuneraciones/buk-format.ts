/* Normalización presentacional de empleados BUK. PURO/testeable.
 *
 * El backend devuelve el slim de empleados como `{[key: string]: unknown}[]`
 * (no tipado), con la forma del BUK Starter. Este helper lee de forma segura
 * los campos que la UI muestra, tolerando nombres alternativos y valores
 * ausentes. NO calcula nada — solo mapea/formatea (§17.4). */

export interface EmployeeSlim {
  /** Id del empleado (siempre string para keys/rutas). "" si falta. */
  id: string;
  /** Nombre completo (fallback "Sin nombre"). */
  fullName: string;
  rut: string | null;
  email: string | null;
  /** Cargo / rol en el BUK (freeform). */
  role: string | null;
  /** Género crudo del BUK (M/F/otro) — usar genderLabel para mostrar. */
  gender: string | null;
  /** `true`/`false` si el estado es legible; `null` si no vino. */
  active: boolean | null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/** Normaliza un empleado crudo del BUK a la forma que consume la UI. */
export function normalizeEmployee(raw: Record<string, unknown>): EmployeeSlim {
  return {
    id: raw.id != null ? String(raw.id) : "",
    fullName: str(raw.full_name) ?? str(raw.name) ?? "Sin nombre",
    rut: str(raw.rut),
    email: str(raw.email),
    role: str(raw.role) ?? str(raw.position) ?? str(raw.cargo),
    gender: str(raw.gender),
    active: resolveActive(raw),
  };
}

function resolveActive(raw: Record<string, unknown>): boolean | null {
  if (typeof raw.active === "boolean") return raw.active;
  const status = str(raw.status);
  if (status == null) return null;
  const v = status.toLowerCase();
  if (v === "activo" || v === "active" || v === "activa") return true;
  if (v === "inactivo" || v === "inactive" || v === "inactiva") return false;
  return null;
}

/** Etiqueta legible del género (chileno neutro). Devuelve el crudo si no mapea. */
export function genderLabel(gender: string | null): string | null {
  if (!gender) return null;
  const v = gender.toLowerCase();
  if (v === "m" || v.startsWith("masc")) return "Masculino";
  if (v === "f" || v.startsWith("fem")) return "Femenino";
  return gender;
}

/** Filtra empleados por texto (nombre / RUT / email / cargo). Case-insensitive. */
export function filterEmployees(items: EmployeeSlim[], query: string): EmployeeSlim[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((e) =>
    `${e.fullName} ${e.rut ?? ""} ${e.email ?? ""} ${e.role ?? ""}`.toLowerCase().includes(q),
  );
}
