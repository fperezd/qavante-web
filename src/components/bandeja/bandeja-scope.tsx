"use client";

import { type ReactNode } from "react";
import { useCompanyScope } from "@/components/shell/company-scope";

export function useBandejaLegalEntityId() {
  return useCompanyScope().activeCompanyId;
}

export function BandejaScope({ children }: { children: ReactNode }) {
  const { activeCompanyId, error, isLoading, refresh } = useCompanyScope();

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-neutral-mid" role="alert">
          No pudimos cargar la Empresa activa.
        </p>
        <button
          type="button"
          onClick={refresh}
          className="text-sm font-medium text-brand-primary hover:underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!isLoading && !activeCompanyId) {
    return <p className="text-sm text-neutral-mid">Elige una Empresa en el encabezado.</p>;
  }

  return <>{activeCompanyId ? children : null}</>;
}
