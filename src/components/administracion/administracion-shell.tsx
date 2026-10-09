"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AdminCompanyScopeNotice } from "./admin-company-scope-notice";

/** Sub-rutas de /administracion que van scoped por la empresa activa (no por toda la cuenta). */
const POR_EMPRESA = new Set([
  "credenciales",
  "conexiones",
  "estructura-gestion",
  "vistas-gestion",
  "monedas",
  "remuneraciones",
  "reglas-clasificacion",
  "plantillas",
]);

export function AdministracionShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const segment = pathname.split("/").filter(Boolean)[1];
  const muestraAlcance = segment != null && POR_EMPRESA.has(segment);

  return (
    <div className="space-y-4">
      {muestraAlcance ? <AdminCompanyScopeNotice /> : null}
      {children}
    </div>
  );
}
