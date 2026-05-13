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

/* Roles con acceso al módulo Administración (Kit DoD C0-15: "Viewer no ve
   módulo Administración"). Backend impone la regla en /api/users (403); este
   gate del sidebar es UX (no defensa de seguridad). Match a la matriz Anexo C.4. */
const ADMIN_ROLES: ReadonlyArray<UserRole> = ["owner", "admin", "technical_admin"];

const MODULES: ReadonlyArray<ModuleLink> = [
  { href: "/inicio", label: "Inicio", Icon: Home },
  { href: "/caja", label: "Caja", Icon: Banknote },
  { href: "/cobrar", label: "Cobrar", Icon: ArrowDownToLine },
  { href: "/pagar", label: "Pagar", Icon: ArrowUpFromLine },
  { href: "/gestion", label: "Gestión", Icon: LineChart },
  { href: "/administracion", label: "Administración", Icon: Settings, visibleFor: ADMIN_ROLES },
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
  const visibleModules = MODULES.filter(
    (m) => !m.visibleFor || (userRole && m.visibleFor.includes(userRole)),
  );

  return (
    <>
      {/* Backdrop mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-neutral-dark/40 md:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-neutral-light bg-surface transition-transform md:sticky md:top-14 md:h-[calc(100vh-3.5rem)] md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Navegación principal"
      >
        <div className="flex items-center justify-between border-b border-neutral-light px-4 py-3 md:hidden">
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

        <nav className="flex-1 space-y-1 px-3 py-4">
          {visibleModules.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                onClick={onCloseMobile}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand-primary-50 text-brand-primary-700"
                    : "text-neutral-mid hover:bg-brand-primary-50 hover:text-brand-primary-700",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
