export type UserRole =
  | "owner"
  | "admin"
  | "finance_manager"
  | "accountant"
  | "viewer"
  | "external_advisor"
  | "technical_admin";

export type SessionUser = {
  id: string;
  email: string;
  role: UserRole;
};

export type SessionData = {
  user: SessionUser;
};

/* Roles conocidos, en valor. Espejo del type de arriba (TS no puede derivarlo solo):
   si agregas un rol, el Record de `ROLE_LABELS` te obliga a actualizar ambos. */
export const USER_ROLES: readonly UserRole[] = [
  "owner",
  "admin",
  "finance_manager",
  "accountant",
  "viewer",
  "external_advisor",
  "technical_admin",
] as const;

/* El backend tipa `MeUser.role` como `string` libre (sin enum en el OpenAPI), así que castear a
   `UserRole` sería mentirle al compilador: si mañana mandan un rol nuevo, la UI lo trataría como
   conocido y lo mostraría como `undefined`. Esto estrecha de verdad: rol desconocido → undefined,
   y la UI cae a su rama conservadora (no ofrece nada que no sepa gobernar). */
export function asUserRole(raw: string | null | undefined): UserRole | undefined {
  return USER_ROLES.find((r) => r === raw);
}
