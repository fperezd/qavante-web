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
