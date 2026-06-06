"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Banknote,
  ArrowDownToLine,
  ArrowUpFromLine,
  LineChart,
  Settings,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/auth/types";

type ModuleLink = {
  href: string;
  label: string;
  Icon: LucideIcon;
  /* Roles que ven este módulo. undefined = todos los roles autenticados. */
  visibleFor?: ReadonlyArray<UserRole>;
};

type NavGroup = { label: string; items: ReadonlyArray<ModuleLink> };

/* Roles con acceso al módulo Administración (Kit DoD C0-15: "Viewer no ve
   módulo Administración"). Backend impone la regla en /api/users (403); este
   gate del sidebar es UX (no defensa de seguridad). Match a la matriz Anexo C.4. */
const ADMIN_ROLES: ReadonlyArray<UserRole> = ["owner", "admin", "technical_admin"];

/* Navegación agrupada por dominio (refresh v1.2): las labels de sección dan
   jerarquía visual. Los hrefs/labels de los links NO cambian (contrato e2e). */
const NAV_GROUPS: ReadonlyArray<NavGroup> = [
  { label: "Principal", items: [{ href: "/inicio", label: "Inicio", Icon: Home }] },
  {
    label: "Tesorería",
    items: [
      { href: "/caja", label: "Caja", Icon: Banknote },
      { href: "/cobrar", label: "Cobrar", Icon: ArrowDownToLine },
      { href: "/pagar", label: "Pagar", Icon: ArrowUpFromLine },
    ],
  },
  { label: "Análisis", items: [{ href: "/gestion", label: "Gestión", Icon: LineChart }] },
  {
    label: "Configuración",
    items: [
      {
        href: "/administracion",
        label: "Administración",
        Icon: Settings,
        visibleFor: ADMIN_ROLES,
      },
    ],
  },
];

export interface AppSidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  userRole?: UserRole;
}

export function AppSidebar({ mobileOpen, onCloseMobile, userRole }: AppSidebarProps) {
  const pathname = usePathname();

  /* Defensa pasiva: si userRole es undefined (sesión rota / fallback), mostramos
     los módulos sin restricción de rol — el módulo gated sigue siendo accesible
     por URL pero la página renderea error/no-data del backend. */
  const canSee = (m: ModuleLink) => !m.visibleFor || (userRole && m.visibleFor.includes(userRole));
  const groups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter(canSee) })).filter(
    (g) => g.items.length > 0,
  );

  return (
    <>
      {/* Backdrop mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-brand-deep/40 backdrop-blur-sm md:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-surface transition-transform md:sticky md:top-14 md:h-[calc(100vh-3.5rem)] md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Navegación principal"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
          <span className="font-semibold text-neutral-dark">Menú</span>
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-md p-1 text-neutral-mid hover:bg-brand-primary-50"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-mid/60">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map(({ href, label, Icon }) => {
                  const active = pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={onCloseMobile}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                        active
                          ? "bg-brand-deep text-white shadow-sm"
                          : "text-neutral-mid hover:bg-brand-primary-50 hover:text-brand-primary-700",
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
