import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

/* CardLink — la salida al detalle de una tarjeta del Inicio v2. Regla transversal: todo dato
   lleva a su detalle (v1 tenía un CTA en cada card; v2 lo había perdido). Sin `href` no se
   renderea nada: no dejamos una afordance que no lleva a ningún lado. */

export interface CardLinkProps {
  /** Destino del detalle. Sin href → no se muestra link. */
  href?: string;
  /** Texto del CTA (ej. "Ver caja"). Default "Ver detalle". */
  cta?: string;
  /** Nombre accesible del contexto, para que el link no sea un "Ver detalle" suelto. */
  contexto?: string;
}

export function CardLink({ href, cta = "Ver detalle", contexto }: CardLinkProps) {
  if (!href) return null;
  return (
    <Link
      href={href}
      aria-label={contexto ? `${cta}: ${contexto}` : cta}
      className="mt-3 inline-flex items-center gap-1 rounded text-[12px] font-bold text-brand-primary transition-colors hover:text-brand-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
    >
      {cta}
      <ChevronRight className="size-3.5" aria-hidden="true" />
    </Link>
  );
}
