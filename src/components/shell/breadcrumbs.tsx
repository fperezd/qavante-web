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
};

function labelFor(segment: string): string {
  if (segment in labels) return labels[segment]!;
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-neutral-mid">
      {segments.map((segment, i) => {
        const href = "/" + segments.slice(0, i + 1).join("/");
        const isLast = i === segments.length - 1;
        return (
          <span key={href} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3" aria-hidden="true" />}
            {isLast ? (
              <span className="font-medium text-neutral-dark">{labelFor(segment)}</span>
            ) : (
              <Link href={href} className="hover:text-brand-primary">
                {labelFor(segment)}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
