"use client";

import * as React from "react";
import { Check, ChevronDown, Loader2, Plus } from "lucide-react";
import { QavanteButton, QavanteInput } from "@/components/qavante";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { useMyTenants, useSwitchTenant, useCreateTenant } from "@/lib/api/tenants";
import { isValidRut } from "@/lib/validators/rut";

/* Selector de empresa (N:M, ADR-0049). Lista las empresas del usuario
   (`GET /api/me/tenants`), permite cambiar la activa (`POST /api/me/active-tenant`)
   y crear una nueva (`POST /api/me/tenants`). Cambiar/crear re-emite la cookie de
   sesión → recargamos para que los Server Components lean el nuevo tenant. */

export function CompanySwitcher() {
  const tenants = useMyTenants();
  const switchTenant = useSwitchTenant();
  const createTenant = useCreateTenant();

  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"list" | "create">("list");
  const ref = React.useRef<HTMLDivElement>(null);

  const items = tenants.data?.tenants ?? [];
  const active = items.find((t) => t.is_active);
  const label = active?.legal_name ?? "Mi empresa";
  const busy = switchTenant.isPending || createTenant.isPending;

  // Cerrar al click afuera.
  React.useEffect(() => {
    if (!open) return undefined;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function reloadIntoTenant() {
    // El switch re-emitió la cookie; recargar para que toda la app (incl. Server
    // Components que leen la sesión) caiga en la empresa nueva.
    if (typeof window !== "undefined") window.location.reload();
  }

  function handleSwitch(tenantId: string) {
    if (busy) return;
    switchTenant.mutate(tenantId, { onSuccess: reloadIntoTenant });
  }

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setMode("list");
        }}
        className="flex items-center gap-1 rounded-lg border border-border bg-surface/70 px-3 py-1.5 text-sm text-neutral-dark hover:bg-brand-primary-50"
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
          className="absolute left-0 z-30 mt-1 w-72 rounded-xl border border-border bg-surface p-1.5 shadow-lg"
        >
          {mode === "list" ? (
            <>
              {tenants.isLoading && (
                <div className="flex items-center gap-2 px-2 py-2 text-sm text-neutral-mid">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Cargando empresas…
                </div>
              )}

              {tenants.isError && (
                <p className="px-2 py-2 text-sm text-danger-500" role="alert">
                  No pudimos cargar tus empresas.
                </p>
              )}

              {items.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  onClick={() => (t.is_active ? setOpen(false) : handleSwitch(t.id))}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm text-neutral-dark hover:bg-brand-primary-50 disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{t.legal_name}</span>
                    <span className="block text-xs text-neutral-mid">{t.role}</span>
                  </span>
                  {t.is_active && (
                    <Check
                      className="h-4 w-4 flex-shrink-0 text-brand-primary"
                      aria-label="Activa"
                    />
                  )}
                </button>
              ))}

              {switchTenant.isError && (
                <p className="px-2 py-1 text-xs text-danger-500" role="alert">
                  {switchTenant.error instanceof ApiError
                    ? apiErrorToUserMessage(switchTenant.error)
                    : "No pudimos cambiar de empresa."}
                </p>
              )}

              <div className="my-1 border-t border-border" />
              <button
                type="button"
                role="menuitem"
                onClick={() => setMode("create")}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium text-brand-primary hover:bg-brand-primary-50"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Agregar empresa
              </button>
            </>
          ) : (
            <CreateCompanyForm
              pending={createTenant.isPending || switchTenant.isPending}
              error={createTenant.error}
              onCancel={() => setMode("list")}
              onCreate={(body) =>
                createTenant.mutate(body, {
                  // Tras crear (no auto-activa), cambiamos a la nueva y recargamos.
                  onSuccess: (created) =>
                    switchTenant.mutate(created.id, { onSuccess: reloadIntoTenant }),
                })
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

function CreateCompanyForm({
  pending,
  error,
  onCancel,
  onCreate,
}: {
  pending: boolean;
  error: unknown;
  onCancel: () => void;
  onCreate: (body: { legal_name: string; rut: string | null; trade_name: string | null }) => void;
}) {
  const [legalName, setLegalName] = React.useState("");
  const [rut, setRut] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  const nameValid = legalName.trim().length >= 2;
  const rutValid = rut.trim().length === 0 || isValidRut(rut);
  const canSubmit = nameValid && rutValid && !pending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    onCreate({
      legal_name: legalName.trim(),
      rut: rut.trim() || null,
      trade_name: null,
    });
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-2 p-1.5">
      <p className="text-sm font-medium text-neutral-dark">Nueva empresa</p>
      <div className="space-y-1">
        <label htmlFor="cs-legal-name" className="text-xs text-neutral-mid">
          Razón social
        </label>
        <QavanteInput
          id="cs-legal-name"
          placeholder="Tooxs Digital SpA"
          value={legalName}
          onValueChange={setLegalName}
          invalid={touched && !nameValid}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="cs-rut" className="text-xs text-neutral-mid">
          RUT (opcional)
        </label>
        <QavanteInput
          id="cs-rut"
          variant="rut"
          placeholder="76.123.456-0"
          value={rut}
          onValueChange={setRut}
          invalid={touched && !rutValid}
        />
      </div>

      {error instanceof ApiError && (
        <p className="text-xs text-danger-500" role="alert">
          {apiErrorToUserMessage(error)}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <QavanteButton
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={pending}
        >
          Cancelar
        </QavanteButton>
        <QavanteButton type="submit" size="sm" loading={pending} disabled={!canSubmit}>
          Crear y entrar
        </QavanteButton>
      </div>
    </form>
  );
}
