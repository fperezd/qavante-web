/* Helpers puros del Asistente (Sprint C9). SIN React → testeables.
   `toolLabel` mapea el nombre plano de la tool (ADR-0004: NUNCA firma ni args)
   a una etiqueta legible para el chip "Consultando …". */

const TOOL_LABEL: Record<string, string> = {
  pulso: "Pulso",
  forecast: "caja proyectada",
  caja: "caja",
  cobranza: "cobranza",
  cobrar: "cobranza",
  pagos: "pagos",
  pagar: "pagos",
  resultado: "resultado operacional",
  drivers: "drivers",
  movimientos: "movimientos",
};

/** Etiqueta legible para un nombre de tool. Desconocida → el nombre tal cual
   (en minúscula), sin exponer estructura. */
export function toolLabel(tool: string): string {
  const key = tool.trim().toLowerCase();
  return TOOL_LABEL[key] ?? key;
}

/* Defensa en profundidad (ADR-0004 — "no confiar ciegamente en el modelo"). El
   backend tiene un post-processor que debe rechazar (500) cualquier `content`
   con fugas de razonamiento; aun así, el FE no renderiza `content` crudo: quita
   marcadores de reasoning que se hayan colado, por si el post-processor del
   backend falla. NO toca el resto del texto (es conservador: solo marcadores
   inequívocos, sin heurísticas tipo `palabra(` que mutilarían prosa legítima). */
const THINKING_BLOCK = /<thinking>[\s\S]*?<\/thinking>/gi;
// Apertura sin cierre → todo lo que le sigue es razonamiento colado: se elimina HASTA EL FINAL
// (antes solo se quitaba el tag y la prosa quedaba visible — la fuga que documentaba el test).
const THINKING_UNCLOSED = /<thinking>[\s\S]*$/i;
// Un `</thinking>` suelto (sin apertura).
const THINKING_STRAY_CLOSE = /<\/thinking>/gi;
// Marcador markdown `**Thinking:**` + el RESTO DE SU LÍNEA (donde vive el razonamiento). Se corta
// hasta el `\n` (no hasta `\n\n`, que mutilaría la respuesta si va en el párrafo siguiente).
const THINKING_MD_LINE = /\*\*\s*thinking\s*:?\s*\*\*[^\n]*(?:\n|$)/gi;

/** Sanitiza el `content` del asistente antes de mostrarlo (defensa en profundidad, ADR-0004):
   elimina bloques y marcadores de reasoning y su contenido, y normaliza espacios. Idempotente.
   Falla CERRADO ante marcadores mal formados (tag sin cerrar / `**Thinking:**` prefijo) — prefiere
   cortar de más antes que filtrar el razonamiento. Texto sin marcadores → sin cambios (salvo trim). */
export function sanitizeAssistantContent(content: string | null | undefined): string {
  if (!content) return "";
  return content
    .replace(THINKING_BLOCK, "")
    .replace(THINKING_UNCLOSED, "")
    .replace(THINKING_STRAY_CLOSE, "")
    .replace(THINKING_MD_LINE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
