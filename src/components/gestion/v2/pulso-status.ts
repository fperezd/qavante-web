import type { PulsoStatus } from "@/lib/api/dashboard";

export interface PulsoPresentation {
  estado: string;
  tono: "ok" | "warn" | "bad" | "neutral";
  known: boolean;
}

const KNOWN_PULSO_STATES: Record<NonNullable<PulsoStatus>, Omit<PulsoPresentation, "known">> = {
  critical: { estado: "Pulso crítico", tono: "bad" },
  weak: { estado: "Pulso débil", tono: "bad" },
  stable: { estado: "Pulso estable", tono: "warn" },
  strong: { estado: "Pulso fuerte", tono: "ok" },
};

const UNKNOWN_PULSO_STATE: PulsoPresentation = {
  estado: "Estado del Pulso pendiente de actualizar",
  tono: "warn",
  known: false,
};

/** La API se ABSTUVO (`status: null`): sin saldo de apertura el Pulso es preliminar
 *  (qavante-api#162). Distinto de "un estado que no conozco": acá el backend dijo
 *  explicitamente que no sabe, y el texto lo refleja. `known: false` en los dos casos, que es
 *  lo que ya impide que se lea como un estado. */
const SIN_DATO_PULSO_STATE: PulsoPresentation = {
  estado: "Pulso sin datos suficientes para calcularlo",
  // NEUTRO, no `warn`. Un ambar dice "ojo con esto", y no hay nada que mirar: no se sabe.
  // Las otras cuatro superficies ya iban a neutro; esta se habia quedado heredando el
  // `UNKNOWN_PULSO_STATE`, que es otro caso (un estado que el front no conoce).
  tono: "neutral",
  known: false,
};

/**
 * La API puede agregar estados antes de que el frontend se actualice. Nunca
 * los presentamos como un estado conocido ni dejamos la interfaz sin texto.
 */
export function resolvePulsoPresentation(status: string | null | undefined): PulsoPresentation {
  if (status == null) return SIN_DATO_PULSO_STATE;
  const known = (KNOWN_PULSO_STATES as Record<string, Omit<PulsoPresentation, "known">>)[status];
  return known ? { ...known, known: true } : UNKNOWN_PULSO_STATE;
}
