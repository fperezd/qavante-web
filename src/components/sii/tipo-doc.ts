/* Mapping de `tipo_doc` (SII Chile) → label humano + abreviatura compacta
   para badge. El backend devuelve el código numérico del SII (33, 34, etc.);
   el FE lo muestra con label + abreviatura tipo "FAC-EL", "BOL-EE", "NC-EL",
   "ND-EL" (compatible con la convención del libro de compras chileno).

   Subset cubre los códigos más usados en PYME (compras y ventas comunes).
   Códigos no mapeados caen al fallback "DOC <code>" (degradación visible,
   no crash). El backend siempre devuelve el código tal cual viene del SII;
   esta tabla es solo presentacional (Anexo F — Voice & Tone).

   Fuentes:
   - Sistema de Facturación Electrónica del SII (códigos de tipo documento).
   - Documentación XML DTE 1.0 del SII. */

export interface TipoDocMeta {
  /** Label completo en español (ej: "Factura Electrónica"). */
  label: string;
  /** Abreviatura compacta para badge (ej: "FAC-EL"). */
  abbr: string;
  /** Familia para filtrado: "factura" | "boleta" | "nota" | "guia" | "otro". */
  family: "factura" | "boleta" | "nota" | "guia" | "otro";
}

const TIPO_DOC_MAP: Record<number, TipoDocMeta> = {
  30: { label: "Factura", abbr: "FAC", family: "factura" },
  32: { label: "Factura Exenta", abbr: "FAC-E", family: "factura" },
  33: { label: "Factura Electrónica", abbr: "FAC-EL", family: "factura" },
  34: { label: "Factura Exenta Electrónica", abbr: "FAC-EE", family: "factura" },
  35: { label: "Boleta", abbr: "BOL", family: "boleta" },
  38: { label: "Boleta Exenta", abbr: "BOL-E", family: "boleta" },
  39: { label: "Boleta Electrónica", abbr: "BOL-EL", family: "boleta" },
  41: { label: "Boleta Exenta Electrónica", abbr: "BOL-EE", family: "boleta" },
  43: { label: "Liquidación Factura Electrónica", abbr: "LIQ-EL", family: "factura" },
  46: { label: "Factura de Compra Electrónica", abbr: "FAC-C-EL", family: "factura" },
  52: { label: "Guía de Despacho Electrónica", abbr: "GD-EL", family: "guia" },
  56: { label: "Nota de Débito Electrónica", abbr: "ND-EL", family: "nota" },
  60: { label: "Nota de Crédito", abbr: "NC", family: "nota" },
  61: { label: "Nota de Crédito Electrónica", abbr: "NC-EL", family: "nota" },
  110: { label: "Factura de Exportación Electrónica", abbr: "FAC-EXP-EL", family: "factura" },
  111: { label: "Nota de Débito de Exportación Electrónica", abbr: "ND-EXP-EL", family: "nota" },
  112: { label: "Nota de Crédito de Exportación Electrónica", abbr: "NC-EXP-EL", family: "nota" },
};

/** Devuelve metadata del tipo de documento. Si el código es null/undefined
 *  o no está mapeado, devuelve un fallback `DOC <code>` legible. */
export function tipoDocMeta(code: number | null | undefined): TipoDocMeta {
  if (code == null || !Number.isFinite(code)) {
    return { label: "Documento", abbr: "DOC", family: "otro" };
  }
  return (
    TIPO_DOC_MAP[code] ?? {
      label: `Documento ${code}`,
      abbr: `DOC-${code}`,
      family: "otro",
    }
  );
}

/** Familias para filtrado en UI (subset de tipos para el dropdown). */
export const TIPO_DOC_FAMILIES = [
  { value: "todos", label: "Todos" },
  { value: "factura", label: "Facturas" },
  { value: "boleta", label: "Boletas" },
  { value: "nota", label: "Notas (crédito y débito)" },
  { value: "guia", label: "Guías de despacho" },
  { value: "otro", label: "Otros" },
] as const;

export type TipoDocFamily = (typeof TIPO_DOC_FAMILIES)[number]["value"];
