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
const THINKING_TAG = /<\/?thinking>/gi;
const THINKING_MD = /\*\*\s*thinking\s*:?\s*\*\*/gi;

/** Sanitiza el `content` del asistente antes de mostrarlo: elimina bloques y
   marcadores de reasoning (`<thinking>…</thinking>`, `**Thinking:**`) y normaliza
   espacios. Idempotente. Texto sin marcadores → sin cambios (salvo trim). */
export function sanitizeAssistantContent(content: string | null | undefined): string {
  if (!content) return "";
  return content
    .replace(THINKING_BLOCK, "")
    .replace(THINKING_TAG, "")
    .replace(THINKING_MD, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
