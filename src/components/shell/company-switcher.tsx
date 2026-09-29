"use client";

import * as React from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { useDismiss } from "@/lib/hooks/use-dismiss";
import { UNATTRIBUTED_COMPANY_ID } from "@/lib/company/active-company";
import { cn } from "@/lib/utils";
import { useCompanyScope } from "./company-scope";

/**
 * Selector global de Empresa. Una Empresa es la entidad legal operativa; el tenant
 * sólo limita autorización y nunca se presenta como un contexto de negocio.
 */
export type CompanySwitcherProps = { variant?: "header" | "mobile" };

export function selectCompanyAndReload(
  currentCompanyId: string | null,
  nextCompanyId: string,
  selectCompany: (companyId: string) => void,
  reload: () => void,
): void {
  if (currentCompanyId === nextCompanyId) return;
  selectCompany(nextCompanyId);
  reload();
}

export function CompanySwitcher({ variant = "header" }: CompanySwitcherProps) {
  const isMobile = variant === "mobile";
  const { activeCompany, activeCompanyId, companies, error, isLoading, selectCompany } =
    useCompanyScope();
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const close = React.useCallback(() => setOpen(false), []);
  const ref = useDismiss<HTMLDivElement>(open, close, triggerRef);
  const label =
    activeCompanyId === UNATTRIBUTED_COMPANY_ID
      ? "Sin atribuir"
      : (activeCompany?.legal_name ?? (isLoading ? "Cargando..." : "Elige una empresa"));

  function handleSelect(companyId: string) {
    setOpen(false);
    selectCompanyAndReload(activeCompanyId, companyId, selectCompany, () =>
      window.location.reload(),
    );
  }

  return (
    <div ref={ref} className={cn("relative", isMobile ? "block md:hidden" : "hidden md:block")}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex items-center gap-1 rounded-lg border border-border bg-surface/70 px-3 py-1.5 text-sm text-neutral-dark hover:bg-brand-primary-50",
          isMobile && "w-full justify-between",
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Empresa activa: ${label}. Cambiar de empresa.`}
        title={label}
      >
        <span className="max-w-[14rem] truncate">{label}</span>
        <ChevronDown className="h-4 w-4 text-neutral-mid" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute left-0 z-30 mt-1 rounded-xl border border-border bg-surface p-1.5 shadow-lg",
            isMobile ? "w-full" : "w-72",
          )}
        >
          {isLoading && (
            <div className="flex items-center gap-2 px-2 py-2 text-sm text-neutral-mid">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Cargando empresas...
            </div>
          )}
          {Boolean(error) && (
            <p className="px-2 py-2 text-sm text-danger-500" role="alert">
              No pudimos cargar tus empresas.
            </p>
          )}
          {companies.map((company) => {
            const isActive = company.id === activeCompany?.id;
            return (
              <button
                key={company.id}
                type="button"
                role="menuitem"
                onClick={() => handleSelect(company.id)}
                className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm text-neutral-dark hover:bg-brand-primary-50"
              >
                <span className="truncate font-medium">{company.legal_name}</span>
                {isActive && (
                  <Check className="h-4 w-4 flex-shrink-0 text-brand-primary" aria-label="Activa" />
                )}
              </button>
            );
          })}
          {companies.length > 0 ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => handleSelect(UNATTRIBUTED_COMPANY_ID)}
              className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm text-neutral-dark hover:bg-brand-primary-50"
            >
              <span className="truncate font-medium">Sin atribuir</span>
              {activeCompanyId === UNATTRIBUTED_COMPANY_ID ? (
                <Check className="h-4 w-4 flex-shrink-0 text-brand-primary" aria-label="Activa" />
              ) : null}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
