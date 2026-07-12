/* Empresa activa preferida — blindaje multi-tenant. El backend arranca la sesión
   en un tenant de config ("MVP Tenant") por defecto (bug backend, PR #461). El FE
   auto-corrige a la empresa real; para que caiga en LA QUE VENÍAS USANDO (no una
   arbitraria) recordamos la última en una cookie (no-httpOnly, sobrevive refresh/
   deploy; NO es token → permitido). */

const COOKIE = "qavante_tenant";

/** Tenant al que volver: la última usada (si el usuario aún pertenece a ella),
    si no la primera de la lista. `null` si no hay ninguna. PURO. */
export function pickPreferredTenant<T extends { id: string }>(
  items: ReadonlyArray<T>,
  lastId: string | null,
): T | null {
  if (items.length === 0) return null;
  const last = lastId ? items.find((t) => t.id === lastId) : undefined;
  return last ?? items[0] ?? null;
}

/** Lee el id de la última empresa usada (cookie). `null` en SSR o si no hay. */
export function getPreferredTenantId(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)qavante_tenant=([^;]+)/);
  return m && m[1] ? decodeURIComponent(m[1]) : null;
}

/** Recuerda la empresa activa (cookie a 1 año). No-op en SSR. */
export function setPreferredTenantId(id: string): void {
  if (typeof document === "undefined" || !id) return;
  document.cookie = `${COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`;
}

/* Circuit-breaker del auto-switch: cuenta intentos de auto-corrección (cookie
   corta que SOBREVIVE al reload). Si el backend queda pegado en el MVP aunque el
   switch reporte éxito, evita el loop infinito de recargas. */
const TRY_COOKIE = "qavante_switch_try";

export function getSwitchAttempts(): number {
  if (typeof document === "undefined") return 0;
  const m = document.cookie.match(/(?:^|;\s*)qavante_switch_try=(\d+)/);
  return m && m[1] ? Number(m[1]) : 0;
}

export function bumpSwitchAttempts(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${TRY_COOKIE}=${getSwitchAttempts() + 1}; path=/; max-age=60; samesite=lax`;
}

export function clearSwitchAttempts(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${TRY_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/** ¿Ya intentamos auto-corregir demasiadas veces? (corta el loop de reload). */
export function autoSwitchExhausted(): boolean {
  return getSwitchAttempts() >= 2;
}
