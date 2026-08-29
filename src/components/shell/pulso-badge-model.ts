import type { PulsoStatus } from "@/lib/api/dashboard";
import { pulsoStatusLabel } from "@/components/inicio/dashboard-format";

/* Qué muestra el badge del Pulso de la barra superior. PURO.

   Existe separado del JSX por una razón medida: el pase §6 encontró que toda la lógica que este
   badge agregó no estaba afirmada en ningún test, y **tres mutantes que reponían el defecto
   sobrevivían con la suite entera en verde** — incluido devolver el badge a verde con
   `status: null`.

   Y este badge sale en la barra superior de TODAS las pantallas: es el publicador más grande
   del "Estable" inventado, y el que ya regresó una vez (qavante-api#162). */

export type BadgeVariant = "success" | "warning" | "danger" | "info";

/** Estado canónico → variant del badge. El `null` NO está acá a propósito: la abstención de la
 *  API tiene su propia rama, no un lookup que falle a un default plausible. */
const VARIANT: Record<NonNullable<PulsoStatus>, BadgeVariant> = {
  strong: "success",
  stable: "success",
  weak: "warning",
  critical: "danger",
};

export interface BadgePulso {
  /** `true` cuando la API se abstuvo. */
  sinDato: boolean;
  variant: BadgeVariant;
  /** El texto del badge. Sin dato NO lleva score: un `null` no imprime nada y dejaba un
   *  " · Estable" suelto, que es peor que el defecto original. */
  texto: string;
  /** El `aria-label` del enlace completo. */
  aria: string;
}

export function badgeDelPulso(
  score: number | null | undefined,
  status: PulsoStatus | null | undefined,
): BadgePulso {
  // `score == null` TAMBIEN es sin-dato, igual que en `anilloDelPulso`. Con solo `status == null`
  // la combinacion `(null, "stable")` imprimia literalmente "null · Estable" -- y qavante-api#227
  // vuelve ese `score` nullable, asi que la combinacion pasa a ser alcanzable. Dos modelos del
  // MISMO objeto con reglas distintas es el molde que este PR viene cerrando.
  const sinDato = status == null || score == null;
  if (sinDato) {
    return {
      sinDato,
      // Neutro-informativo, no verde: "no sabemos" no es una buena noticia. Y tampoco rojo,
      // que sería inventar una mala.
      variant: "info",
      texto: pulsoStatusLabel(null),
      aria: "Pulso de tu empresa: sin datos suficientes para calcularlo. Ver alertas.",
    };
  }
  const etiqueta = pulsoStatusLabel(status);
  return {
    sinDato,
    // El `?? "info"` cubre un status fuera de contrato, que es otra cosa que el `null`.
    variant: (VARIANT as Record<string, BadgeVariant>)[status] ?? "info",
    texto: `${score} · ${etiqueta}`,
    aria: `Pulso de tu empresa: ${score} de 100, ${etiqueta}. Ver alertas.`,
  };
}
