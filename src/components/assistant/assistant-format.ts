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
