/* Helpers de navegación. PURO/testeable. */

/** Solo permite rutas INTERNAS como destino de una redirección (p. ej. el
 *  `?redirect=` post-login). Rechaza URLs absolutas, protocol-relative (`//host`)
 *  y el truco del backslash (`/\host`) → evita open-redirect a sitios de phishing.
 *  Fallback: `/inicio`. */
export function safeInternalPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/")) return "/inicio";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/inicio";
  return raw;
}
