import Image from "next/image";
import { cn } from "@/lib/utils";

/* Logo Qavante: wordmark + lema "Anticipa. Decide. Avanza.".
 * Hero conserva el lema oficial para auth y onboarding. Header usa el
 * wordmark recortado para que siga siendo legible a 32 px de alto. */

export type QavanteLogoVariant = "hero" | "header";

export interface QavanteLogoProps {
  variant?: QavanteLogoVariant;
  className?: string;
  /** Sobreescribe el texto alternativo cuando ya hay una marca visible. */
  alt?: string;
}

const VARIANT_HEIGHT: Record<QavanteLogoVariant, number> = {
  hero: 96,
  header: 32,
};

const LOGO_ASSET: Record<QavanteLogoVariant, { src: string; aspectRatio: number }> = {
  hero: { src: "/qavante-logo-full.png", aspectRatio: 2400 / 684 },
  header: { src: "/qavante-logo.png", aspectRatio: 1600 / 364 },
};

export function QavanteLogo({
  variant = "hero",
  className,
  alt = "Qavante: Anticipa. Decide. Avanza.",
}: QavanteLogoProps) {
  const height = VARIANT_HEIGHT[variant];
  const asset = LOGO_ASSET[variant];
  const width = Math.round(height * asset.aspectRatio);

  return (
    <Image
      src={asset.src}
      alt={alt}
      width={width}
      height={height}
      priority={variant === "hero"}
      /* Bypass del optimizer de Next: evita requests que rompen networkidle
         en e2e; Cloudflare CDN cachea el asset estatico en produccion. */
      unoptimized
      className={cn("h-auto w-auto select-none", className)}
      style={{ height, width: "auto" }}
    />
  );
}
