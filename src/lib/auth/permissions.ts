/* Permisos reales del backend (registry `PERMISSIONS_BY_ROLE`, ADR Anexo C.4). El backend expone
   `GET /api/users/me/permissions` → `{ permissions: string[], role }`. El vocabulario son strings
   punteados (`users.write`, `financial.read`, …); el owner trae el wildcard `"*"` (todo).

   Esto reemplaza el "adivinar por rol con tablas hardcodeadas" del FE: en vez de codificar la matriz
   de permisos acá (que se desincroniza del backend), preguntamos qué puede hacer el usuario y
   gobernamos la UI con eso. Puro y testeable; el hook vive en `lib/api/users.ts`. */

/** Permiso que gobierna asignar/transferir el rol Dueño: solo el owner lo tiene (via wildcard). */
export const PERM_ASIGNAR_OWNER = "*";

/** ¿El set de permisos concede `needed`? Reglas:
 *   - `"*"` en el set → concede TODO (owner).
 *   - match exacto (`users.invite` cubre `users.invite`).
 *   - wildcard de segmento en el set (`users.*` cubre `users.invite`).
 *  Conservador: sin permisos (lista vacía / no cargó) → false. El fallback a rol lo decide el caller,
 *  no este helper (así el helper no miente concediendo de más). */
export function hasPermission(permissions: readonly string[] | undefined, needed: string): boolean {
  if (!permissions || permissions.length === 0) return false;
  if (needed === "") return false;
  for (const p of permissions) {
    if (p === "*") return true;
    if (p === needed) return true;
    if (p.endsWith(".*")) {
      const prefix = p.slice(0, -1); // "users.*" → "users."
      if (needed.startsWith(prefix)) return true;
    }
  }
  return false;
}
