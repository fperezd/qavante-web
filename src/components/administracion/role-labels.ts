import type { UserRole } from "@/lib/auth/types";

/* Mapping rol técnico → label visible para usuario. Mantener sincronizado con
   Anexo C.4 del Documento Maestro v2.6.4. Si el backend agrega un rol nuevo,
   actualizar acá Y en `src/lib/auth/types.ts`. */
export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Dueño",
  admin: "Administrador",
  finance_manager: "Finanzas",
  accountant: "Contador",
  viewer: "Solo lectura",
  external_advisor: "Asesor externo",
  technical_admin: "Admin técnico",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  owner: "Acceso completo. Único que puede transferir propiedad.",
  admin: "Configura la app y administra usuarios.",
  finance_manager: "Gestiona caja, cobranza, pagos.",
  accountant: "Lee información financiera, exporta a contabilidad.",
  viewer: "Solo lectura. No edita ni acciona.",
  external_advisor: "Asesor externo con acceso limitado.",
  technical_admin: "Soporte técnico Tooxs. No es rol de cliente.",
};

/* Roles que se pueden asignar desde la UI de invitar / cambiar rol.
   Excluimos `technical_admin` (rol Tooxs, no se invita desde la app del cliente). */
export const ASSIGNABLE_ROLES: UserRole[] = [
  "owner",
  "admin",
  "finance_manager",
  "accountant",
  "viewer",
  "external_advisor",
];

export type Status = "active" | "suspended" | "invited";

export const STATUS_LABELS: Record<Status, string> = {
  active: "Activo",
  suspended: "Suspendido",
  invited: "Invitado",
};
