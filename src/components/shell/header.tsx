"use client";

import { Bell, ChevronDown, Menu, Search } from "lucide-react";
import { QavanteBadge } from "@/components/qavante";

export interface AppHeaderProps {
  onMenuClick: () => void;
}

export function AppHeader({ onMenuClick }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-neutral-light bg-surface px-4">
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
        <span className="text-lg font-bold text-brand-primary">Qavante</span>
      </div>

      {/* Selector empresa (placeholder) */}
      <button
        type="button"
        className="hidden items-center gap-1 rounded-md border border-neutral-light bg-surface px-3 py-1.5 text-sm text-neutral-dark hover:bg-brand-primary-50 md:inline-flex"
        aria-label="Seleccionar empresa"
        disabled
      >
        Empresa demo
        <ChevronDown className="h-4 w-4 text-neutral-mid" />
      </button>

      {/* Búsqueda CMD+K (placeholder) */}
      <button
        type="button"
        className="hidden flex-1 items-center gap-2 rounded-md border border-neutral-light bg-background px-3 py-1.5 text-sm text-neutral-mid hover:border-brand-primary md:inline-flex md:max-w-md"
        aria-label="Búsqueda global"
        disabled
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Buscar…</span>
        <kbd className="rounded border border-neutral-light bg-surface px-1.5 py-0.5 font-mono text-[10px] text-neutral-mid">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-3">
        {/* Pulso badge (placeholder) */}
        <div className="hidden items-center gap-1.5 md:flex">
          <span className="text-xs text-neutral-mid">Pulso</span>
          <QavanteBadge variant="success">742</QavanteBadge>
        </div>

        {/* Notificaciones */}
        <button
          type="button"
          className="relative rounded-md p-2 text-neutral-mid hover:bg-brand-primary-50"
          aria-label="Notificaciones"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger-500" />
        </button>

        {/* Avatar perfil */}
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-xs font-semibold text-surface"
          aria-label="Perfil"
        >
          FP
        </button>
      </div>
    </header>
  );
}
