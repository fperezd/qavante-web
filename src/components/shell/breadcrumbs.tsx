"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const labels: Record<string, string> = {
  inicio: "Inicio",
  caja: "Caja",
  cobrar: "Cobrar",
  pagar: "Pagar",
  gestion: "Gestión",
  administracion: "Administración",
  usuarios: "Usuarios",
  credenciales: "Credenciales",
  "mi-cuenta": "Mi cuenta",
};

function labelFor(segment: string): string {
  if (segment in labels) return labels[segment]!;
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  /* El segmento actual (último) ya lo muestra el <h1> de la página → no lo
     repetimos acá para no duplicar el título. El breadcrumb muestra solo el
     rastro de ancestros (navegable). En páginas de primer nivel no hay
     ancestros → no se renderiza nada (queda solo el título grande). */
  const trail = segments.slice(0, -1);
  if (trail.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-neutral-mid">
      {trail.map((segment, i) => {
        const href = "/" + trail.slice(0, i + 1).join("/");
        return (
          <span key={href} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3" aria-hidden="true" />}
            <Link href={href} className="hover:text-brand-primary">
              {labelFor(segment)}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
