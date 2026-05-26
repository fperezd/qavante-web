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
      /* `unoptimized`: bypass del Next image optimizer. El PNG se sirve
         directo desde public/, sin pasar por /_next/image. Razón: el
         optimizer en dev/test genera requests adicionales que rompen
         `waitForLoadState("networkidle")` de los e2e (timeouts a 30s en
         /app/administracion/{usuarios,credenciales} — protected-routes
         mobile spec). En prod el browser cachea el asset estático y el
         peso real (~optimizado por Cloudflare CDN) compensa. */
      unoptimized
      className={cn("h-auto w-auto select-none", className)}
      style={{ height, width: "auto" }}
    />
  );
}
