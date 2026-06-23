"use client";

import Link from "next/link";
import { Bell, ChevronDown, Menu, Search } from "lucide-react";
import { QavanteBadge, QavanteLogo } from "@/components/qavante";
import { useMe } from "@/lib/api/users";

export interface AppHeaderProps {
  onMenuClick: () => void;
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

export function AppHeader({ onMenuClick }: AppHeaderProps) {
  const { data } = useMe();
  const user = data?.user;
  const companyName = user?.tenant_name?.trim() || "Mi empresa";

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

      {/* Empresa activa (tenant_name de /api/me). El selector multi-empresa
          (N:M, ADR-0017) es trabajo futuro; por ahora muestra la empresa real. */}
      <span
        className="hidden items-center gap-1 rounded-lg border border-border bg-surface/70 px-3 py-1.5 text-sm text-neutral-dark md:inline-flex"
        aria-label={`Empresa activa: ${companyName}`}
        title={companyName}
      >
        <span className="max-w-[14rem] truncate">{companyName}</span>
        <ChevronDown className="h-4 w-4 text-neutral-mid opacity-40" aria-hidden="true" />
      </span>

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
          <span aria-hidden="true">{initialsOf(user?.name)}</span>
        </Link>
      </div>
    </header>
  );
}
