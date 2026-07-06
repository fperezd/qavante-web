"use client";

import * as React from "react";
import { toast } from "sonner";
import { Building2, Check, Plus, Pencil, Loader2 } from "lucide-react";
import { QavanteCard, QavanteButton, QavanteBadge, QavanteInlineError } from "@/components/qavante";
import { useMyTenants, useSwitchTenant, useCreateTenant, useUpdateTenant } from "@/lib/api/tenants";
import { useMe } from "@/lib/api/users";
import { ROLE_LABELS } from "@/components/administracion/role-labels";
import { CreateCompanyForm } from "@/components/administracion/create-company-form";
import { EditCompanyForm } from "@/components/administracion/edit-company-form";
import type { UserRole } from "@/lib/auth/types";

/* Administración → Empresas. Gestiona las empresas del usuario: listarlas,
   cambiar la activa y CREAR una nueva. Crear una empresa es configuración (ligada
   al plan/modelo de tenant), por eso vive acá y no en el selector del header
   (pedido de Fernando 2026-07-05). El módulo Administración ya está gateado por
   rol → viewer no lo ve. */

export function EmpresasView() {
  const tenants = useMyTenants();
  const me = useMe();
  const switchTenant = useSwitchTenant();
  const createTenant = useCreateTenant();
  const updateTenant = useUpdateTenant();
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState(false);

  const allItems = tenants.data?.tenants ?? [];
  // Ocultar el "MVP Tenant" de config (mismo tapón que el selector).
  const items = allItems.filter((t) => t.legal_name?.trim().toLowerCase() !== "mvp tenant");
  const active = items.find((t) => t.is_active);
  const companyRut = me.data?.user.company_rut ?? "";
  const busy = switchTenant.isPending || createTenant.isPending || updateTenant.isPending;

  function reloadIntoTenant() {
    if (typeof window !== "undefined") window.location.reload();
  }

  function handleSwitch(id: string) {
    if (busy) return;
    switchTenant.mutate(id, { onSuccess: reloadIntoTenant });
  }

  return (
    <div className="space-y-4">
      <QavanteCard
        variant="bordered"
        header={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-medium">
              <Building2 className="h-4 w-4 text-brand-primary" aria-hidden="true" />
              Tus empresas
            </span>
            {!creating && (
              <QavanteButton size="sm" onClick={() => setCreating(true)} disabled={busy}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Agregar empresa
              </QavanteButton>
            )}
          </div>
        }
      >
        {tenants.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-neutral-mid">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Cargando tus empresas…
          </div>
        ) : tenants.isError ? (
          <QavanteInlineError
            error={tenants.error}
            what="tus empresas"
            onRetry={() => tenants.refetch()}
          />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-neutral-dark">
                    <span className="truncate">{t.legal_name}</span>
                    {t.is_active && <QavanteBadge variant="success">Activa</QavanteBadge>}
                  </p>
                  <p className="text-xs text-neutral-mid">
                    {ROLE_LABELS[t.role as UserRole] ?? t.role}
                  </p>
                </div>
                {t.is_active ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs text-success-700">
                      <Check className="h-4 w-4" aria-hidden="true" />
                      En uso
                    </span>
                    {!editing && (
                      <QavanteButton
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(true);
                          setCreating(false);
                        }}
                        disabled={busy}
                        aria-label={`Editar ${t.legal_name}`}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        Editar
                      </QavanteButton>
                    )}
                  </div>
                ) : (
                  <QavanteButton
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSwitch(t.id)}
                    disabled={busy}
                  >
                    Cambiar a esta
                  </QavanteButton>
                )}
              </li>
            ))}
          </ul>
        )}

        {switchTenant.isError && (
          <p className="mt-2 text-xs text-danger-500" role="alert">
            No pudimos cambiar de empresa. Intenta de nuevo.
          </p>
        )}
      </QavanteCard>

      {editing && active && (
        <QavanteCard
          variant="bordered"
          header={<span className="font-medium">Editar {active.legal_name}</span>}
        >
          <p className="mb-3 text-sm text-neutral-mid">
            Edita los datos de tu empresa activa. Deja el nombre comercial vacío si no lo quieres
            cambiar.
          </p>
          <EditCompanyForm
            initialLegalName={active.legal_name}
            initialRut={companyRut}
            pending={updateTenant.isPending}
            error={updateTenant.error}
            onCancel={() => setEditing(false)}
            onSave={(body) =>
              updateTenant.mutate(body, {
                onSuccess: () => {
                  setEditing(false);
                  toast.success("Empresa actualizada", {
                    description: "Los datos de tu empresa se guardaron.",
                  });
                },
              })
            }
          />
        </QavanteCard>
      )}

      {creating && (
        <QavanteCard
          variant="bordered"
          header={<span className="font-medium">Agregar empresa</span>}
        >
          <p className="mb-3 text-sm text-neutral-mid">
            Agrega otra empresa a tu cuenta. Según tu plan puede afectar lo que facturas — revisa
            las condiciones antes de agregar.
          </p>
          <CreateCompanyForm
            pending={createTenant.isPending || switchTenant.isPending}
            error={createTenant.error}
            onCancel={() => setCreating(false)}
            onCreate={(body) =>
              createTenant.mutate(body, {
                // Tras crear (no auto-activa), cambiamos a la nueva y recargamos.
                onSuccess: (created) =>
                  switchTenant.mutate(created.id, { onSuccess: reloadIntoTenant }),
              })
            }
          />
        </QavanteCard>
      )}
    </div>
  );
}
