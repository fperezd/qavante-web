import { formatClp } from "./clp";

/* Parseo de los montos que el backend manda como STRING decimal ("18500000",
   "-300000.50", "", null). Esto vivía copiado carácter por carácter en cuatro
   módulos de dominio (cobrar / gestión / inicio / pagar), cada uno con su
   comentario diciendo "consolidación pendiente". Cuatro copias de una función de
   plata son cuatro lugares donde arreglar un bug y tres donde olvidarlo.

   Vive en `formatters/` y no en un dominio porque ninguno de los cuatro es dueño:
   el string-decimal es el contrato de TRANSPORTE del API, transversal a todas las
   pantallas. */

/** String-decimal del backend → number. Vacío / no numérico → `0`.

    Ojo con el `0`: es una defensa contra basura del transporte, NO un "no se
    sabe". Si el campo puede legítimamente venir sin dato, usa
    `parseAmountOrNull` — aplastar "no se sabe" a `0` es la pantalla afirmando
    "cero pesos" sobre datos que no tiene. */
export function parseAmount(raw: string | null | undefined): number {
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** String-decimal del backend → number PRESERVANDO el "no se sabe": `null` /
    `undefined` / vacío / en blanco / no numérico → `null`.

    `"0"` → `0`: el cero VERIFICADO se conserva como cero. Confundirlo con
    desconocido es tan mentiroso como el camino inverso.

    El `trim()` importa: `Number(" ")` da `0`, así que un string en blanco sin
    recortar se convertiría en "$0" en pantalla. */
export function parseAmountOrNull(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = raw.trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/* ── Importe DESCONOCIDO por cuarentena de conciliación (qavante-api#907, #687) ──────────────
   El backend publica `null` + `amount_unknown_reason: "reconciliation_quarantine"` cuando el
   importe depende de una evidencia de pago en revisión. No es cero, no es un piso y no se suma:
   la pantalla lo dice con estas palabras, iguales en todas las vistas. */

/** Motivo que el contrato publica hoy para un importe desconocido. */
export const AMOUNT_UNKNOWN_QUARANTINE = "reconciliation_quarantine";

/** Rótulo corto en lugar de la cifra. */
export const MONTO_EN_REVISION = "En revisión";

/** Explicación para el usuario (tooltip, "sin dato", detalle). */
export const MONTO_EN_REVISION_MOTIVO =
  "Hay un pago en revisión de conciliación que afecta este monto; lo mostraremos cuando se resuelva.";

/** ¿El registro declara su importe desconocido? Un motivo presente basta: nunca se lee su
 *  importe (que viene `null`) como 0. */
export function importeDesconocido(
  value: { amount_unknown_reason?: string | null } | null | undefined,
): boolean {
  return value?.amount_unknown_reason != null;
}

/** Monto CLP formateado, o "En revisión" cuando el backend lo publica `null` por cuarentena de
 *  conciliación. Para campos cuyo único `null` es la cuarentena (#907); nunca devuelve "$0"
 *  por un `null`. */
export function formatClpOEnRevision(raw: string | null | undefined): string {
  const value = parseAmountOrNull(raw);
  return value == null ? MONTO_EN_REVISION : formatClp(value);
}

/* ── Importe DESCONOCIDO por falta de Empresa activa (qavante-api#928) ───────────────────────
   Sin Empresa activa, Cobrar y Pagar se abstienen: el backend publica los montos `null` con
   `amount_unknown_reason: "missing_scope"`. No es cero ni "al día", y tampoco es un pago en
   revisión: falta elegir la Empresa. */

/** Motivo que publica Inicio cuando la sesión no tiene Empresa activa. */
export const AMOUNT_UNKNOWN_MISSING_SCOPE = "missing_scope";

/** Rótulo corto en lugar de la cifra. */
export const MONTO_SIN_EMPRESA = "Sin dato";

/** Explicación para el usuario. */
export const MONTO_SIN_EMPRESA_MOTIVO = "Selecciona una Empresa para ver estos montos.";

/** Motivos de importe desconocido que el contrato publica hoy. */
export type AmountUnknownReason =
  | typeof AMOUNT_UNKNOWN_QUARANTINE
  | typeof AMOUNT_UNKNOWN_MISSING_SCOPE;

/** Texto por motivo. Es un `Record` sobre la unión: un motivo nuevo en el contrato no compila
 *  hasta que tenga sus palabras (el "switch exhaustivo" de este módulo). */
const TEXTO_IMPORTE_DESCONOCIDO: Record<AmountUnknownReason, { rotulo: string; motivo: string }> = {
  [AMOUNT_UNKNOWN_QUARANTINE]: { rotulo: MONTO_EN_REVISION, motivo: MONTO_EN_REVISION_MOTIVO },
  [AMOUNT_UNKNOWN_MISSING_SCOPE]: { rotulo: MONTO_SIN_EMPRESA, motivo: MONTO_SIN_EMPRESA_MOTIVO },
};

/** Motivo desconocido para el cliente (contrato más nuevo que la web): se dice "sin dato",
 *  nunca "$0" ni una razón inventada. */
const TEXTO_SIN_DATO = {
  rotulo: "Sin dato",
  motivo: "No tenemos este monto por ahora.",
};

function textoImporteDesconocido(reason: string | null | undefined) {
  if (reason == null) return TEXTO_IMPORTE_DESCONOCIDO[AMOUNT_UNKNOWN_QUARANTINE];
  return (
    (TEXTO_IMPORTE_DESCONOCIDO as Record<string, { rotulo: string; motivo: string }>)[reason] ??
    TEXTO_SIN_DATO
  );
}

/** Rótulo en lugar de la cifra según el motivo del backend. Sin motivo (`null`) conserva el de
 *  la cuarentena, que era el único `null` posible antes de #928. */
export function rotuloImporteDesconocido(reason: string | null | undefined): string {
  return textoImporteDesconocido(reason).rotulo;
}

/** Explicación según el motivo del backend (mismo criterio que `rotuloImporteDesconocido`). */
export function motivoImporteDesconocido(reason: string | null | undefined): string {
  return textoImporteDesconocido(reason).motivo;
}

/** Monto CLP formateado, o el rótulo del motivo cuando el backend lo publica `null`. Nunca "$0"
 *  por un `null`. */
export function formatClpODesconocido(
  raw: string | null | undefined,
  reason: string | null | undefined,
): string {
  const value = parseAmountOrNull(raw);
  return value == null ? rotuloImporteDesconocido(reason) : formatClp(value);
}
