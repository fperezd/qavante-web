import type { PulsoStatus } from "@/lib/api/dashboard";

export interface PulsoPresentation {
  estado: string;
  tono: "ok" | "warn" | "bad";
  known: boolean;
}

const KNOWN_PULSO_STATES: Record<PulsoStatus, Omit<PulsoPresentation, "known">> = {
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

/**
 * La API puede agregar estados antes de que el frontend se actualice. Nunca
 * los presentamos como un estado conocido ni dejamos la interfaz sin texto.
 */
export function resolvePulsoPresentation(status: string): PulsoPresentation {
  const known = (KNOWN_PULSO_STATES as Record<string, Omit<PulsoPresentation, "known">>)[status];
  return known ? { ...known, known: true } : UNKNOWN_PULSO_STATE;
}
