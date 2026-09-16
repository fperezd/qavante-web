/* Certeza de la fecha de vencimiento — UN solo lector para Pagar y Cobrar.
 *
 * El contrato (`PayableItem` y `OverdueDocument` en `src/lib/api/types.ts`, generado del OpenAPI)
 * publica por ítem `due_date_certainty` (`confirmed | estimated | unconfirmed`) y `due_date_note`,
 * un copy server-owned que explica una fecha estimada o sin confirmar. Las dos pantallas los
 * muestran tal cual; ninguna deduce certeza por su cuenta.
 *
 * LO QUE ESTE MÓDULO DECIDE, escrito acá y no sólo en el PR:
 *   · La certeza NO se infiere: ni porque exista una fecha, ni por la procedencia, ni por el tipo
 *     de documento. Sólo se lee el campo.
 *   · Un ítem SIN el campo (o con un valor fuera del enum) NO se asume `confirmed`: queda como
 *     `no_informada`, con su propia etiqueta. Es el "no sé" explícito de la Ley 8, no un default
 *     plausible.
 *   · Sólo `confirmed` puede alimentar un "vencido" o un "crítico" derivado en el cliente. Una
 *     fecha estimada o sin confirmar se ordena por su fecha, pero nunca se presenta como mora.
 *   · La nota se muestra como llega. Si viene vacía o ausente, no se inventa una: la etiqueta
 *     sola ya dice el estado. */

export type CertezaVencimiento = "confirmed" | "estimated" | "unconfirmed";

/** Lo que la pantalla presenta: los tres valores del contrato o el "no sé" cuando falta. */
export type CertezaPresentada = CertezaVencimiento | "no_informada";

const CERTEZAS: ReadonlyArray<CertezaVencimiento> = ["confirmed", "estimated", "unconfirmed"];

/** Etiqueta de la pill. `confirmed` no lleva pill: es el caso normal y no necesita apellido. */
export const CERTEZA_LABEL: Record<Exclude<CertezaPresentada, "confirmed">, string> = {
  estimated: "Fecha estimada",
  unconfirmed: "Fecha sin confirmar",
  no_informada: "Certeza no informada",
};

/** Texto plano para exportar (CSV/Excel), en minúsculas y sin inventar nada. */
export const CERTEZA_CSV: Record<CertezaPresentada, string> = {
  confirmed: "confirmada",
  estimated: "estimada",
  unconfirmed: "sin confirmar",
  no_informada: "no informada",
};

export interface CertezaDeFecha {
  certeza: CertezaPresentada;
  /** `due_date_note` recortada, o `null` si no vino o vino vacía. Nunca se rellena. */
  nota: string | null;
}

/** Lee la certeza y la nota de un ítem del contrato. Tolera `unknown` a propósito: el guard HTTP
 *  no valida estos campos, así que un valor raro llega igual y acá se declara como no informado. */
export function certezaDe(
  item: { due_date_certainty?: unknown; due_date_note?: unknown } | null | undefined,
): CertezaDeFecha {
  const cruda = item?.due_date_certainty;
  const certeza = CERTEZAS.find((c) => c === cruda) ?? "no_informada";
  const notaCruda = item?.due_date_note;
  const nota = typeof notaCruda === "string" && notaCruda.trim() ? notaCruda.trim() : null;
  return { certeza, nota };
}

export function esConfirmada(certeza: CertezaPresentada): certeza is "confirmed" {
  return certeza === "confirmed";
}

/** `estimated_due_date_count` del resumen (Pagar y Cobrar lo publican con el mismo nombre). Es
 *  un conteo del servidor y se muestra tal cual: nunca se recuenta desde la página. `null` si el
 *  campo no vino o no es un conteo: no se asume 0. */
export function conteoEstimadasDe(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Texto de la pill + la nota server-owned cuando existe: "Fecha estimada · <nota>". */
export function certezaTexto(c: CertezaDeFecha): string | null {
  if (esConfirmada(c.certeza)) return null;
  const label = CERTEZA_LABEL[c.certeza];
  return c.nota ? `${label} · ${c.nota}` : label;
}
