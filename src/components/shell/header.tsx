"use client";

import Link from "next/link";
import { Bell, Menu, Search } from "lucide-react";
import { QavanteBadge, QavanteLogo } from "@/components/qavante";
import { useMe } from "@/lib/api/users";
import { useDashboardSummary } from "@/lib/api/dashboard";
import { CompanySwitcher } from "./company-switcher";
import { SyncStatusIndicator } from "./sync-status-indicator";
import { SyncAllButton } from "./sync-all-button";

/** Mapea el estado del Pulso (backend) al variant del badge. */
const PULSO_VARIANT: Record<string, "success" | "warning" | "danger"> = {
  strong: "success",
  stable: "success",
  weak: "warning",
  critical: "danger",
};

export interface AppHeaderProps {
  onMenuClick: () => void;
  /** Abre el command palette (⌘K) al clickear la barra de búsqueda. */
  onOpenSearch?: () => void;
  /** Monta el indicador de sincronización (gated `syncStatus`, server-resuelto). */
  syncStatusEnabled?: boolean;
}

/** Iniciales para el avatar a partir del nombre ("Fernando Pérez" → "FP"). */
function initialsOf(name?: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  return parts
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function AppHeader({ onMenuClick, onOpenSearch, syncStatusEnabled }: AppHeaderProps) {
  const { data } = useMe();
  const user = data?.user;
  /* Pulso real del negocio (mismo dato que el Inicio Ejecutivo; comparte cache
     de React Query). Si el backend no lo expone (flag OFF o sin sesión), no
     mostramos badge — nada de números placeholder que contradigan el dashboard. */
  const { data: dashboard } = useDashboardSummary();
  const pulso = dashboard?.pulso ?? null;

  return (
    <header className="glass sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-border px-4">
      {/* Mobile hamburguesa */}
      <button
        type="button"
        onClick={onMenuClick}
        className="rounded-md p-2 text-neutral-mid hover:bg-brand-primary-50 md:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Logo Qavante */}
      <div className="flex items-center gap-2">
        <QavanteLogo variant="header" alt="Qavante" />
      </div>

      {/* Selector de empresa (N:M, ADR-0049): listar / cambiar / crear. */}
      <CompanySwitcher />

      {/* Búsqueda global / command palette (⌘K). */}
      <button
        type="button"
        onClick={onOpenSearch}
        className="hidden flex-1 items-center gap-2 rounded-lg border border-border bg-surface/60 px-3 py-1.5 text-sm text-neutral-mid transition-colors hover:border-brand-primary md:inline-flex md:max-w-md"
        aria-label="Buscar y navegar (Ctrl+K)"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Buscar…</span>
        <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-neutral-mid">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-3">
        {/* Actualizar todo (SII + banco): un botón global que trae los datos, en
            vez de sincronizar fuente por fuente (patrón Chipax). */}
        <SyncAllButton />

        {/* Indicador de sincronización (gated `syncStatus`). */}
        {syncStatusEnabled && <SyncStatusIndicator />}

        {/* Pulso real del negocio (mismo valor que el Inicio Ejecutivo). Solo se
            muestra si el backend lo entrega; si no, no hay badge. */}
        {pulso && (
          <Link
            href="/inicio"
            className="hidden items-center gap-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 md:flex"
            aria-label={`Pulso de tu empresa: ${pulso.score} puntos. Ver Inicio.`}
          >
            <span className="text-xs text-neutral-mid" aria-hidden="true">
              Pulso
            </span>
            <QavanteBadge variant={PULSO_VARIANT[pulso.status] ?? "info"} aria-hidden="true">
              {pulso.score}
            </QavanteBadge>
          </Link>
        )}

        {/* Notificaciones. El punto de "sin leer" se mostrará cuando exista el
            conteo real (evitamos el cry-wolf de un dot siempre encendido). */}
        <button
          type="button"
          className="relative rounded-md p-2 text-neutral-mid hover:bg-brand-primary-50"
          aria-label="Notificaciones"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
        </button>

        {/* Avatar perfil — enlaza a Mi cuenta (perfil + cerrar sesión) */}
        <Link
          href="/mi-cuenta"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-deep to-brand-primary text-xs font-semibold text-surface shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          aria-label="Mi cuenta"
        >
          <span aria-hidden="true">{initialsOf(user?.name)}</span>
        </Link>
      </div>
    </header>
  );
}
