"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Building2, ChevronDown } from "lucide-react";
import { useLegalEntities } from "@/lib/api/legal-entities";

const LegalEntityContext = createContext<string | null>(null);

export function useBandejaLegalEntityId() {
  return useContext(LegalEntityContext);
}

export function BandejaScope({
  initialLegalEntityId,
  children,
}: {
  initialLegalEntityId?: string;
  children: ReactNode;
}) {
  const companies = useLegalEntities();
  const [selectedId, setSelectedId] = useState<string | null>(initialLegalEntityId ?? null);

  useEffect(() => {
    if (!companies.data?.entities.length) return;
    if (selectedId && companies.data.entities.some((company) => company.id === selectedId)) return;
    setSelectedId(
      companies.data.entities.find((company) => company.is_default)?.id ??
        companies.data.entities[0]!.id,
    );
  }, [companies.data, selectedId]);

  const validId = companies.data?.entities.some((company) => company.id === selectedId)
    ? selectedId
    : null;

  return (
    <LegalEntityContext.Provider value={validId ?? null}>
      <div className="space-y-5">
        <label className="block max-w-sm text-sm font-medium text-neutral-mid">
          Sociedad
          <span className="relative mt-1.5 block">
            <Building2
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-primary"
              aria-hidden="true"
            />
            <select
              aria-label="Seleccionar sociedad de la Bandeja"
              value={validId ?? ""}
              disabled={!companies.data?.entities.length}
              onChange={(event) => {
                const id = event.target.value;
                setSelectedId(id);
                const url = new URL(window.location.href);
                url.searchParams.set("legal_entity_id", id);
                url.searchParams.delete("movimiento");
                window.history.replaceState(null, "", url);
              }}
              className="w-full appearance-none rounded border border-border bg-surface py-2.5 pl-10 pr-9 text-sm text-neutral-dark outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:cursor-not-allowed"
            >
              {!validId && <option value="">Selecciona una sociedad</option>}
              {companies.data?.entities.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.legal_name}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-mid"
              aria-hidden="true"
            />
          </span>
        </label>
        {companies.isError ? (
          <p className="text-sm text-neutral-mid" role="alert">
            No pudimos determinar la sociedad de estas tareas.
          </p>
        ) : !companies.isLoading && !validId ? (
          <p className="text-sm text-neutral-mid">
            No hay una sociedad disponible para estas tareas.
          </p>
        ) : validId ? (
          children
        ) : null}
      </div>
    </LegalEntityContext.Provider>
  );
}
