import type { PulsoStatus } from "@/lib/api/dashboard";

/* `PulsoStatus` sale del OpenAPI y va a incluir `null` en cuanto mergee qavante-api#162.
   Las tablas se keyean sobre el estado REAL para que esa regeneracion no las rompa: el
   `null` no es un estado con color, es la ausencia de uno. */
type EstadoReal = NonNullable<PulsoStatus>;

/* Qué pinta el anillo del Pulso. PURO → se testea sin React, igual que el resto de los
   `*-model.ts` de esta carpeta.

   Existe separado del componente por una razón concreta: la decisión de "qué se muestra cuando
   el backend no sabe" es la que se equivocó, y una decisión así tiene que poder afirmarse en un
   test sin montar un DOM. */

/** Color, label y clase de texto del anillo. */
export interface AnilloPulso {
  /** `true` cuando la API se abstuvo: no hay score ni estado que mostrar. */
  sinDato: boolean;
  color: string;
  label: string;
  textClass: string;
  /** El número grande. `"—"` cuando no se sabe: un 0 se lee como un pulso pésimo. */
  numero: string;
  /** 0–100 ya acotado, para la animación. */
  score: number;
}

const COLOR: Record<EstadoReal, string> = {
  strong: "var(--color-success-500)",
  stable: "var(--color-success-400)",
  weak: "var(--color-warning-500)",
  critical: "var(--color-danger-500)",
};

const LABEL: Record<EstadoReal, string> = {
  strong: "Fuerte",
  stable: "Estable",
  weak: "Débil",
  critical: "Crítica",
};

const TEXT: Record<EstadoReal, string> = {
  strong: "text-success-700",
  stable: "text-success-700",
  weak: "text-warning-700",
  critical: "text-danger-500",
};

/** Lo que se pinta cuando el backend NO SABE.
 *
 *  Neutro a propósito, no rojo: "no sabemos" no es "está mal", y inventar una mala noticia es el
 *  error simétrico de inventar una buena. */
const SIN_DATO = {
  color: "var(--color-neutral-mid)",
  label: "Sin datos",
  textClass: "text-neutral-mid",
} as const;

/** Fallback para un `status` FUERA DE CONTRATO — un valor que el backend no valida en runtime y
 *  que no debe dejar el anillo sin color ni el label en "undefined".
 *
 *  El `null` NO pasa por acá: ése es el "no sé" declarado y tiene su propia rama. Meterlos en el
 *  mismo cajón es lo que hacía que la abstención del backend se pintara verde. */
function conFallback<T>(rec: Record<EstadoReal, T>, status: EstadoReal): T {
  return (rec as Record<string, T>)[status] ?? rec.stable;
}

/** Decide qué muestra el anillo.
 *
 *  `status: null` o `score: null` significan que la API se abstuvo: sin saldo de apertura el
 *  pulso es preliminar (qavante-api#162). Antes ese caso caía en el fallback a `stable` y la
 *  pantalla decía **"Estable"** en verde — medido en producción sobre una caja en −$1.121.250,
 *  en la misma respuesta que reportaba la brecha. */
export function anilloDelPulso(
  score: number | null | undefined,
  status: PulsoStatus | null | undefined,
): AnilloPulso {
  const sinDato = status == null || score == null;
  const acotado = Math.max(0, Math.min(100, score ?? 0));
  if (sinDato) {
    return { sinDato, ...SIN_DATO, numero: "—", score: acotado };
  }
  return {
    sinDato,
    color: conFallback(COLOR, status),
    label: conFallback(LABEL, status),
    textClass: conFallback(TEXT, status),
    numero: String(Math.round(acotado)),
    score: acotado,
  };
}
