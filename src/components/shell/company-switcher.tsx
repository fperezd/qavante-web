"use client";

import * as React from "react";
import { AlertTriangle, Check, ChevronDown, Loader2, Star } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { useMyTenants, useSwitchTenant } from "@/lib/api/tenants";
import { ROLE_LABELS } from "@/components/administracion/role-labels";
import { useDismiss } from "@/lib/hooks/use-dismiss";
import { cn } from "@/lib/utils";
import {
  pickPreferredTenant,
  getPreferredTenantId,
  setPreferredTenantId,
  getDefaultTenantId,
  setDefaultTenantId,
  clearDefaultTenantId,
  bumpSwitchAttempts,
  clearSwitchAttempts,
  autoSwitchExhausted,
} from "@/lib/tenant/preferred-tenant";
import type { UserRole } from "@/lib/auth/types";

/* Selector de empresa (N:M, ADR-0049). Lista las empresas del usuario
   (`GET /api/me/tenants`) y permite CAMBIAR la activa (`POST /api/me/active-tenant`)
   → re-emite la cookie de sesión y recargamos para que los Server Components lean
   el nuevo tenant. CREAR una empresa NO vive acá: es configuración (ligada al plan)
   → Administración → Empresas (pedido de Fernando 2026-07-05). */

/** `variant`: "header" (desktop, en la barra superior) o "mobile" (dentro del
 *  drawer de navegación — el header lo oculta en móvil). Mismo comportamiento;
 *  cambia solo dónde se muestra y el ancho del dropdown. */
export function CompanySwitcher({ variant = "header" }: { variant?: "header" | "mobile" } = {}) {
  const isMobile = variant === "mobile";
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
  /* Empresa PREDETERMINADA que el usuario eligió a propósito (★). Estado para
     re-renderizar al marcarla (la cookie sola no dispara render). Se lee en el
     cliente tras montar (SSR no ve cookies). Interino en cookie hasta que CC-API
     persista `default_tenant_id` (#749). */
  const [defaultId, setDefaultId] = React.useState<string | null>(null);
  React.useEffect(() => setDefaultId(getDefaultTenantId()), []);
  /* La empresa a la que volver: la PREDETERMINADA si la elegiste; si no, la ÚLTIMA
     usada (cookie); si no, la primera real. Clave en multi-empresa. */
  const preferred = React.useMemo(
    () => pickPreferredTenant(items, defaultId ?? getPreferredTenantId()),
    [items, defaultId],
  );
  const marcarDefault = (id: string) => {
    setDefaultTenantId(id);
    setDefaultId(id);
  };
  const quitarDefault = () => {
    clearDefaultTenantId();
    setDefaultId(null);
  };
  /* Si el auto-switch se agotó (backend pegado en MVP) o falló, NO mostramos el
     nombre real sobre datos del MVP (mentiría) → prompteamos elegir empresa. */
  const autoSwitchStuck = activeIsMvp && (autoSwitchExhausted() || switchTenant.isError);
  /* El label nunca muestra "MVP Tenant": si la sesión cayó en él, mostramos la
     empresa preferida (la autocorrección de abajo va a cambiar a ella enseguida).
     Mientras cargan las empresas, "Cargando…"; si el auto-switch quedó pegado,
     "Elige tu empresa" (honesto, no un nombre real sobre datos ajenos). */
  const label = tenants.isLoading
    ? "Cargando…"
    : autoSwitchStuck
      ? "Elige tu empresa"
      : ((activeIsMvp ? preferred?.legal_name : active?.legal_name) ?? "Mi empresa");
  const busy = switchTenant.isPending;

  /* Recuerda la empresa activa real (cookie) para poder volver a ELLA si la
     sesión cae al MVP tras un refresh/deploy. Al aterrizar en una real, el loop
     quedó resuelto → limpiamos el contador del circuit-breaker. */
  React.useEffect(() => {
    if (active && !isMvp(active)) {
      setPreferredTenantId(active.id);
      clearSwitchAttempts();
    }
  }, [active]);

  /* Autocorrección del default: el backend arranca la sesión en el MVP Tenant.
     Si la activa es el MVP, cambiamos a la empresa PREFERIDA (la última usada) una
     sola vez por carga. Circuit-breaker (cookie que sobrevive el reload): si tras
     un par de intentos la sesión SIGUE en MVP (backend pegado), paramos — nada de
     loop infinito de recargas. Tapón hasta que CC-API corrija el default (#461). */
  const didAutoSwitch = React.useRef(false);
  React.useEffect(() => {
    if (didAutoSwitch.current || busy) return;
    if (!activeIsMvp || autoSwitchExhausted()) return;
    const real = preferred;
    if (!real) return;
    didAutoSwitch.current = true;
    setPreferredTenantId(real.id);
    bumpSwitchAttempts();
    switchTenant.mutate(real.id, { onSuccess: reloadIntoTenant });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIsMvp, preferred]);

  /* Si quedamos pegados en el MVP (auto-switch agotado) y hay empresas reales para
     elegir, abrimos el selector UNA vez: el chip rojo solo es fácil de no ver, y la
     pantalla igual muestra datos ajenos → hay que empujar la elección, no esconderla. */
  const didAutoOpen = React.useRef(false);
  React.useEffect(() => {
    if (didAutoOpen.current) return;
    if (autoSwitchStuck && items.length > 0) {
      didAutoOpen.current = true;
      setOpen(true);
    }
  }, [autoSwitchStuck, items.length]);

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
    <div ref={ref} className={cn("relative", isMobile ? "block md:hidden" : "hidden md:block")}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm",
          autoSwitchStuck
            ? "border-danger-500/40 bg-danger-50 font-semibold text-danger-500 hover:opacity-90"
            : "border-border bg-surface/70 text-neutral-dark hover:bg-brand-primary-50",
          isMobile && "w-full justify-between",
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          autoSwitchStuck
            ? "No pudimos cargar tu empresa. Elige una de la lista."
            : `Empresa activa: ${label}. Cambiar de empresa.`
        }
        title={label}
      >
        {autoSwitchStuck && <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />}
        <span className="max-w-[14rem] truncate">{label}</span>
        <ChevronDown
          className={cn("h-4 w-4", autoSwitchStuck ? "text-danger-500" : "text-neutral-mid")}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute left-0 z-30 mt-1 rounded-xl border border-border bg-surface p-1.5 shadow-lg",
            isMobile ? "w-full" : "w-72",
          )}
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

          {autoSwitchStuck && items.length > 0 && (
            <p className="px-2 pb-1.5 pt-1 text-xs text-neutral-mid">
              Estos datos no son de tu empresa. Elige la tuya para ver los tuyos:
            </p>
          )}

          {items.map((t) => {
            const isDefault = t.id === defaultId;
            return (
              <div key={t.id} className="flex items-center gap-1">
                <button
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  onClick={() => (t.is_active ? setOpen(false) : handleSwitch(t.id))}
                  className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm text-neutral-dark hover:bg-brand-primary-50 disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {t.legal_name}
                      {isDefault && (
                        <span className="ml-1.5 text-[11px] font-normal text-warning-700">
                          · predeterminada
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-neutral-mid">
                      {ROLE_LABELS[t.role as UserRole] ?? t.role}
                    </span>
                  </span>
                  {t.is_active && (
                    <Check
                      className="h-4 w-4 flex-shrink-0 text-brand-primary"
                      aria-label="Activa"
                    />
                  )}
                </button>
                {/* Marcar como empresa por defecto (★) — solo tiene sentido con >1. */}
                {items.length > 1 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => (isDefault ? quitarDefault() : marcarDefault(t.id))}
                    aria-pressed={isDefault}
                    aria-label={
                      isDefault
                        ? `${t.legal_name} es tu empresa por defecto. Quitar.`
                        : `Hacer a ${t.legal_name} tu empresa por defecto.`
                    }
                    title={
                      isDefault
                        ? "Tu empresa por defecto (clic para quitar)"
                        : "Hacer predeterminada"
                    }
                    className="flex-shrink-0 rounded-md p-1.5 hover:bg-brand-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-50"
                  >
                    <Star
                      className={cn(
                        "h-4 w-4",
                        isDefault ? "fill-warning-500 text-warning-500" : "text-neutral-mid",
                      )}
                      aria-hidden="true"
                    />
                  </button>
                )}
              </div>
            );
          })}

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
