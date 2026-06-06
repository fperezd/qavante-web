"use client";

import Link from "next/link";
import { Bell, ChevronDown, Menu, Search } from "lucide-react";
import { QavanteBadge, QavanteLogo } from "@/components/qavante";

export interface AppHeaderProps {
  onMenuClick: () => void;
}

export function AppHeader({ onMenuClick }: AppHeaderProps) {
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

      {/* Selector empresa (placeholder) */}
      <button
        type="button"
        className="hidden items-center gap-1 rounded-lg border border-border bg-surface/70 px-3 py-1.5 text-sm text-neutral-dark hover:bg-brand-primary-50 md:inline-flex"
        aria-label="Seleccionar empresa"
        disabled
      >
        Empresa demo
        <ChevronDown className="h-4 w-4 text-neutral-mid" />
      </button>

      {/* Búsqueda CMD+K (placeholder) */}
      <button
        type="button"
        className="hidden flex-1 items-center gap-2 rounded-lg border border-border bg-surface/60 px-3 py-1.5 text-sm text-neutral-mid transition-colors hover:border-brand-primary md:inline-flex md:max-w-md"
        aria-label="Búsqueda global"
        disabled
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Buscar…</span>
        <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-neutral-mid">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-3">
        {/* Pulso badge (placeholder) — contexto descriptivo para SR */}
        <div
          className="hidden items-center gap-1.5 md:flex"
          aria-label="Pulso de tu empresa: 742 puntos"
        >
          <span className="text-xs text-neutral-mid" aria-hidden="true">
            Pulso
          </span>
          <QavanteBadge variant="success" aria-hidden="true">
            742
          </QavanteBadge>
        </div>

        {/* Notificaciones */}
        <button
          type="button"
          className="relative rounded-md p-2 text-neutral-mid hover:bg-brand-primary-50"
          aria-label="Notificaciones (hay nuevas sin leer)"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          <span
            className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger-500"
            aria-hidden="true"
          />
        </button>

        {/* Avatar perfil — enlaza a Mi cuenta (perfil + cerrar sesión) */}
        <Link
          href="/mi-cuenta"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-deep to-brand-primary text-xs font-semibold text-surface shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          aria-label="Mi cuenta"
        >
          <span aria-hidden="true">FP</span>
        </Link>
      </div>
    </header>
  );
}
