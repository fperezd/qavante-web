"use client";

import { useCompanyScope } from "@/components/shell/company-scope";

/** Recuerda que credenciales, conexiones, plantillas, etc. aplican a la empresa del header. */
export function AdminCompanyScopeNotice() {
  const { activeCompany, isLoading } = useCompanyScope();

  if (isLoading) {
    return (
      <p
        className="rounded-lg border border-rediseno-hairline bg-rediseno-neutro-bg/60 px-4 py-2.5 text-sm text-rediseno-tinta-3"
        role="status"
        aria-live="polite"
      >
        Cargando la empresa activa…
      </p>
    );
  }

  const nombre = activeCompany?.legal_name?.trim() || "la empresa seleccionada en el encabezado";

  return (
    <p
      className="rounded-lg border border-rediseno-hairline bg-slate-50/80 px-4 py-2.5 text-sm text-rediseno-tinta-2"
      role="status"
    >
      Lo que configuras en esta sección aplica a{" "}
      <strong className="font-semibold text-rediseno-tinta">{nombre}</strong>. Si administras otra
      sociedad, elige la empresa correcta arriba antes de conectar fuentes o editar plantillas.
    </p>
  );
}
