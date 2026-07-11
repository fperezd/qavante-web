"use client";

import * as React from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { useMyTenants, useSwitchTenant } from "@/lib/api/tenants";
import { ROLE_LABELS } from "@/components/administracion/role-labels";
import { useDismiss } from "@/lib/hooks/use-dismiss";
import {
  pickPreferredTenant,
  getPreferredTenantId,
  setPreferredTenantId,
} from "@/lib/tenant/preferred-tenant";
import type { UserRole } from "@/lib/auth/types";

/* Selector de empresa (N:M, ADR-0049). Lista las empresas del usuario
   (`GET /api/me/tenants`) y permite CAMBIAR la activa (`POST /api/me/active-tenant`)
   → re-emite la cookie de sesión y recargamos para que los Server Components lean
   el nuevo tenant. CREAR una empresa NO vive acá: es configuración (ligada al plan)
   → Administración → Empresas (pedido de Fernando 2026-07-05). */

export function CompanySwitcher() {
  const tenants = useMyTenants();
  const switchTenant = useSwitchTenant();

  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const close = React.useCallback(() => setOpen(false), []);
  const ref = useDismiss<HTMLDivElement>(open, close, triggerRef);

  const allItems = tenants.data?.tenants ?? [];
  /* Parche temporal: ocultar el tenant de config "MVP Tenant" — trae datos de otra
     conexión y confunde (Fernando creyó que eran suyos). El fix de fondo es que
     CC-API deje de usarlo como `MVP_TENANT_ID` de config y como tenant activo por
     defecto (escalado, PR #461). */
  const isMvp = (t: { legal_name?: string | null }) =>
    t.legal_name?.trim().toLowerCase() === "mvp tenant";
  const items = allItems.filter((t) => !isMvp(t));
  const active = allItems.find((t) => t.is_active);
  const activeIsMvp = active != null && isMvp(active);
  /* La empresa a la que volver: la ÚLTIMA que usaste (cookie), no una arbitraria
     — clave en multi-empresa. Si ya no pertenecés a ella, cae en la primera. */
  const preferred = React.useMemo(
    () => pickPreferredTenant(items, getPreferredTenantId()),
    [items],
  );
  /* El label nunca muestra "MVP Tenant": si la sesión cayó en él, mostramos la
     empresa preferida (la autocorrección de abajo va a cambiar a ella enseguida).
     Mientras cargan las empresas, "Cargando…" (no "Mi empresa" con datos vacíos). */
  const label = tenants.isLoading
    ? "Cargando…"
    : ((activeIsMvp ? preferred?.legal_name : active?.legal_name) ?? "Mi empresa");
  const busy = switchTenant.isPending;

  /* Recuerda la empresa activa real (cookie) para poder volver a ELLA si la
     sesión cae al MVP tras un refresh/deploy. */
  React.useEffect(() => {
    if (active && !isMvp(active)) setPreferredTenantId(active.id);
  }, [active]);

  /* Autocorrección del default: el backend arranca la sesión en el MVP Tenant.
     Si la activa es el MVP, cambiamos a la empresa PREFERIDA (la última usada) una
     sola vez (el switch persiste en la cookie de sesión → al recargar la activa ya
     es la real → no hay loop). Tapón hasta que CC-API corrija el default (PR #461). */
  const didAutoSwitch = React.useRef(false);
  React.useEffect(() => {
    if (didAutoSwitch.current || busy) return;
    if (!activeIsMvp) return;
    const real = preferred;
    if (!real) return;
    didAutoSwitch.current = true;
    setPreferredTenantId(real.id);
    switchTenant.mutate(real.id, { onSuccess: reloadIntoTenant });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIsMvp, preferred]);

  function reloadIntoTenant() {
    // El switch re-emitió la cookie; recargar para que toda la app (incl. Server
    // Components que leen la sesión) caiga en la empresa nueva.
    if (typeof window !== "undefined") window.location.reload();
  }

  function handleSwitch(tenantId: string) {
    if (busy) return;
    setPreferredTenantId(tenantId); // recordar para el próximo arranque
    switchTenant.mutate(tenantId, { onSuccess: reloadIntoTenant });
  }

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
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
                <span className="block text-xs text-neutral-mid">
                  {ROLE_LABELS[t.role as UserRole] ?? t.role}
                </span>
              </span>
              {t.is_active && (
                <Check className="h-4 w-4 flex-shrink-0 text-brand-primary" aria-label="Activa" />
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
        </div>
      )}
    </div>
  );
}
