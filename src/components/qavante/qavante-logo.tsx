import Image from "next/image";
import { cn } from "@/lib/utils";

/* Logo Qavante — wordmark + glifo de ola + tagline "Avanzar con inteligencia
 * financiera". Sirve para login/auth screens (variant="hero" — grande,
 * centrado) y para topbar (variant="header" — compacto, alineado a la
 * izquierda). El asset vive en `public/qavante-logo.png` y se sirve vía
 * `next/image` para auto-optimización (WebP/AVIF + tamaños responsivos).
 *
 * Ratio del asset: 1672×941 (~1.776:1). Las dimensiones se calculan a
 * partir del height para mantener proporción. */

export type QavanteLogoVariant = "hero" | "header";

export interface QavanteLogoProps {
  variant?: QavanteLogoVariant;
  className?: string;
  /** Sobreescribe el alt por defecto. Útil cuando va junto a otro texto
   *  visible que ya dice "Qavante" (evita redundancia para SR). */
  alt?: string;
}

const VARIANT_HEIGHT: Record<QavanteLogoVariant, number> = {
  hero: 96,
  header: 32,
};

const ASPECT_RATIO = 1672 / 941;

export function QavanteLogo({
  variant = "hero",
  className,
  alt = "Qavante — gestión financiera para PYMEs chilenas",
}: QavanteLogoProps) {
  const height = VARIANT_HEIGHT[variant];
  const width = Math.round(height * ASPECT_RATIO);

  return (
    <Image
      src="/qavante-logo.png"
      alt={alt}
      width={width}
      height={height}
      priority={variant === "hero"}
      className={cn("h-auto w-auto select-none", className)}
      style={{ height, width: "auto" }}
    />
  );
}
