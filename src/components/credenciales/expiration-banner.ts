/* Lógica de tono de banner para certificado digital según días hasta
   vencer. Extraído de certificate-card.tsx para poder unit-testear sin
   montar React.

   Umbrales WCAG / UX (alineados con docs/backend-contracts/
   c1-sii-credentials.md § 3.3):
     > 60 días → ok (sin banner)
     31–60     → warn (amarillo, "renueva pronto")
     1–30      → urgent (rojo, "renueva ahora")
     ≤ 0       → expired (rojo bloqueante, "carga uno nuevo") */

import { daysUntil } from "./format";
import { concordar } from "@/lib/formatters/count";

export type ExpirationBanner =
  | { tone: "ok" }
  | { tone: "warn" | "urgent"; daysLeft: number }
  | { tone: "expired" };

export function getBanner(expiresAt?: string): ExpirationBanner {
  if (!expiresAt) return { tone: "ok" };
  const days = daysUntil(expiresAt);
  if (days <= 0) return { tone: "expired" };
  if (days <= 30) return { tone: "urgent", daysLeft: days };
  if (days <= 60) return { tone: "warn", daysLeft: days };
  return { tone: "ok" };
}

/** Etiqueta del badge de vencimiento → "Vence en 1 día" / "Vence en 30 días" (issue #94: el
 * umbral `urgent` empieza en 1 día, así que "Vence en 1 días" es un caso real y vivo, no de
 * laboratorio — un certificado a punto de expirar es justo lo que este banner existe para
 * avisar con más fuerza). Fuera de warn/urgent, el label fijo de cada tono no lleva número. */
export function certificateExpiryLabel(
  banner: ExpirationBanner,
  fixedLabel: Record<"ok" | "warn" | "urgent" | "expired", string>,
): string {
  if (banner.tone === "warn" || banner.tone === "urgent") {
    return `Vence en ${banner.daysLeft} ${concordar(banner.daysLeft, "día", "días")}`;
  }
  return fixedLabel[banner.tone];
}
