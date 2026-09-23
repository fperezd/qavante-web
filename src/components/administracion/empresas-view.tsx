"use client";

import * as React from "react";
import { Building2, Check, Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { QavanteBadge, QavanteButton, QavanteCard, QavanteInlineError, QavanteInput } from "@/components/qavante";
import { useCompanyScope } from "@/components/shell/company-scope";
import { useCreateLegalEntity, useRenameLegalEntity } from "@/lib/api/legal-entities";

/** Administración de Empresas: un tenant es interno y nunca se administra acá. */
export function EmpresasView() {
  const { activeCompanyId, companies, error, isLoading, refresh, selectCompany } = useCompanyScope();
  const createCompany = useCreateLegalEntity();
  const renameCompany = useRenameLegalEntity();
  const [creating, setCreating] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const pending = createCompany.isPending || renameCompany.isPending;
  const validName = name.trim().length >= 2;

  function beginCreate() {
    setName("");
    setEditingId(null);
    setCreating(true);
  }

  function beginRename(id: string, legalName: string) {
    setName(legalName);
    setCreating(false);
    setEditingId(id);
  }

  function cancelForm() {
    if (pending) return;
    setCreating(false);
    setEditingId(null);
    setName("");
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const legal_name = name.trim();
    if (!validName || pending) return;
    if (creating) {
      createCompany.mutate({ legal_name }, {
        onSuccess: (company) => {
          selectCompany(company.id);
          cancelForm();
          toast.success("Empresa creada", { description: "La nueva Empresa ya está activa." });
        },
      });
      return;
    }
    if (editingId) {
      renameCompany.mutate({ id: editingId, legal_name }, {
        onSuccess: (company) => {
          cancelForm();
          toast.success("Empresa actualizada", { description: `${company.legal_name} fue actualizada.` });
        },
      });
    }
  }

  return (
    <div className="space-y-4">
      <QavanteCard
        variant="bordered"
        header={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-medium">
              <Building2 className="h-4 w-4 text-brand-primary" aria-hidden="true" />
              Empresas
            </span>
            {!creating && !editingId && (
              <QavanteButton size="sm" onClick={beginCreate} disabled={pending}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Agregar empresa
              </QavanteButton>
            )}
          </div>
        }
      >
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-neutral-mid">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Cargando empresas...
          </div>
        ) : error ? (
          <QavanteInlineError error={error} what="tus empresas" onRetry={refresh} />
        ) : (
          <ul className="divide-y divide-border">
            {companies.map((company) => {
              const active = company.id === activeCompanyId;
              return (
                <li key={company.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-neutral-dark">
                      <span className="truncate">{company.legal_name}</span>
                      {active && <QavanteBadge variant="success">Activa</QavanteBadge>}
                    </p>
                    {company.is_default && <p className="text-xs text-neutral-mid">Empresa inicial</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    {active ? (
                      <span className="inline-flex items-center gap-1 px-2 text-xs text-success-700">
                        <Check className="h-4 w-4" aria-hidden="true" />
                        En uso
                      </span>
                    ) : (
                      <QavanteButton size="sm" variant="ghost" onClick={() => selectCompany(company.id)} disabled={pending}>
                        Usar esta
                      </QavanteButton>
                    )}
                    <QavanteButton size="sm" variant="ghost" onClick={() => beginRename(company.id, company.legal_name)} disabled={pending} aria-label={`Editar ${company.legal_name}`}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </QavanteButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </QavanteCard>

      {(creating || editingId) && (
        <QavanteCard variant="bordered" header={<span className="font-medium">{creating ? "Agregar empresa" : "Editar empresa"}</span>}>
          <form onSubmit={submit} className="flex flex-wrap items-end gap-3" noValidate>
            <div className="min-w-56 flex-1 space-y-1">
              <label htmlFor="company-legal-name" className="text-sm font-medium text-neutral-dark">Razón social</label>
              <QavanteInput id="company-legal-name" value={name} onValueChange={setName} invalid={name.length > 0 && !validName} />
            </div>
            <QavanteButton type="button" size="sm" variant="ghost" onClick={cancelForm} disabled={pending}>Cancelar</QavanteButton>
            <QavanteButton type="submit" size="sm" loading={pending} disabled={!validName}>{creating ? "Agregar" : "Guardar"}</QavanteButton>
          </form>
        </QavanteCard>
      )}
    </div>
  );
}
