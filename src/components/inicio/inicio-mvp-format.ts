/* Helpers puros del InicioMvpView — extraídos del .tsx para poder
   testear sin React (sigue patrón cash-flow-format del Sprint C3 MVP). */

/** Saludo es-CL según hora local del cliente:
    - 0-11 → "Buenos días"
    - 12-18 → "Buenas tardes"
    - 19-23 → "Buenas noches"
    Concatena el displayName tal cual viene (sin alterar case/espacios). */
export function buildGreeting(now: Date, displayName: string): string {
  const hour = now.getHours();
  /* Date inválida → getHours() es NaN y todas las comparaciones caen al else
     ("Buenas noches") silenciosamente. Saludo neutro sin prefijo horario. */
  if (Number.isNaN(hour)) return `Hola, ${displayName}`;
  let prefix: string;
  if (hour < 12) prefix = "Buenos días";
  else if (hour < 19) prefix = "Buenas tardes";
  else prefix = "Buenas noches";
  return `${prefix}, ${displayName}`;
}

/** Formato es-CL para timestamp ISO de `last_login_at`. Devuelve
    'Sin registro' si el input es null/undefined/string vacío. Fallback
    al string original si no parsea como Date. */
export function formatLastLogin(iso: string | null | undefined): string {
  if (!iso) return "Sin registro";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("es-CL", {
    /* timeZone explícito: el backend entrega UTC (sufijo Z) y el runtime de
       deploy es Cloudflare Workers (UTC). Sin esto, un usuario chileno vería
       la hora UTC en "Último ingreso", con día/hora corridos. America/Santiago
       es el default de org del backend. */
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
