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
  ChevronDown,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CompanySwitcher } from "./company-switcher";
import type { UserRole } from "@/lib/auth/types";

type SubLink = { href: string; label: string; needsRemun?: boolean };

type ModuleLink = {
  href: string;
  label: string;
  Icon: LucideIcon;
  /* Roles que ven este módulo. undefined = todos los roles autenticados. */
  visibleFor?: ReadonlyArray<UserRole>;
  /* Sub-ítems que se despliegan cuando la sección está activa (ej. Pagar). */
  children?: ReadonlyArray<SubLink>;
};

type NavGroup = { label: string; items: ReadonlyArray<ModuleLink> };

/* Roles con acceso al módulo Administración (Kit DoD C0-15: "Viewer no ve
   módulo Administración"). Backend impone la regla en /api/users (403); este
   gate del sidebar es UX (no defensa de seguridad). Match a la matriz Anexo C.4. */
const ADMIN_ROLES: ReadonlyArray<UserRole> = ["owner", "admin", "technical_admin"];

/* Sub-ítems de Pagar, en el orden de Fernando (2026-07-28): "a quién le pago",
   en lenguaje de dueño. Remuneraciones y Previred dependen del flag `remuneraciones`
   (BUK) → se filtran si está OFF. Los otros existen siempre (la página degrada). */
const PAGAR_CHILDREN: ReadonlyArray<SubLink> = [
  { href: "/pagar/proveedores", label: "Proveedores" },
  { href: "/pagar/honorarios", label: "Honorarios" },
  { href: "/remuneraciones", label: "Remuneraciones", needsRemun: true },
  { href: "/pagar/previred", label: "Previred", needsRemun: true },
  { href: "/pagar/impuestos", label: "Impuestos y TGR" },
  { href: "/pagar/obligaciones", label: "Préstamos" },
];

/* Sub-ítems de Gestión (top 5 de análisis para el dueño, pedido de Fernando
   2026-07-28): separan lo que hoy vive apretado en /gestion. "Resultado del mes"
   es el propio /gestion. */
const GESTION_CHILDREN: ReadonlyArray<SubLink> = [
  { href: "/gestion", label: "Resultado" },
  { href: "/gestion/margenes", label: "Márgenes" },
  { href: "/gestion/costos", label: "Costos y gastos" },
  { href: "/gestion/tendencia", label: "Tendencia" },
  { href: "/gestion/comparativo", label: "Comparativo" },
  { href: "/gestion/ciclo-de-caja", label: "Ciclo de caja" },
  { href: "/gestion/punto-equilibrio", label: "Punto de equilibrio" },
  { href: "/gestion/clientes", label: "Clientes 360" },
  { href: "/gestion/proveedores", label: "Proveedores 360" },
];

/* Navegación agrupada por dominio. "Cobros y pagos" (antes "Tesorería", jerga
   contable — pedido de Fernando 2026-07-28). Pagar despliega sus sub-ítems al
   entrar en la sección. Los hrefs de los links NO cambian (contrato e2e). */
const NAV_GROUPS: ReadonlyArray<NavGroup> = [
  { label: "Principal", items: [{ href: "/inicio", label: "Inicio", Icon: Home }] },
  {
    label: "Cobros y pagos",
    items: [
      { href: "/caja", label: "Caja", Icon: Banknote },
      { href: "/cobrar", label: "Cobrar", Icon: ArrowDownToLine },
      { href: "/pagar", label: "Pagar", Icon: ArrowUpFromLine, children: PAGAR_CHILDREN },
    ],
  },
  {
    label: "Análisis",
    items: [{ href: "/gestion", label: "Gestión", Icon: LineChart, children: GESTION_CHILDREN }],
  },
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
  /** `remuneraciones` ON → muestra los sub-ítems de Pagar Remuneraciones + Previred
     (fuente BUK). Lo resuelve el layout (server). OFF/undefined → no se muestran. */
  remuneracionesEnabled?: boolean;
}

export function AppSidebar({
  mobileOpen,
  onCloseMobile,
  userRole,
  remuneracionesEnabled,
}: AppSidebarProps) {
  const pathname = usePathname();

  /* Defensa pasiva: si userRole es undefined (sesión rota / fallback), mostramos
     los módulos sin restricción de rol — el módulo gated sigue siendo accesible
     por URL pero la página renderea error/no-data del backend. */
  const canSee = (m: ModuleLink) => !m.visibleFor || (userRole && m.visibleFor.includes(userRole));
  const groups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter(canSee) })).filter(
    (g) => g.items.length > 0,
  );

  const linkCls = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
      active
        ? "bg-brand-deep text-white shadow-sm"
        : "text-neutral-mid hover:bg-brand-primary-50 hover:text-brand-primary-700",
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
          // Mobile: drawer z-40 (sobre el header z-20). Desktop (md): columna
          // estática z-10 (bajo el header) → así el dropdown del selector de
          // empresa, que vive en el header, queda por encima del sidebar.
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-surface transition-transform md:sticky md:top-14 md:z-10 md:h-[calc(100vh-3.5rem)] md:translate-x-0",
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

        {/* Selector de empresa (N:M) en el drawer móvil — en desktop vive en el
            header, que lo oculta en móvil. Sin esto, quien tiene varias empresas
            no podía cambiarla desde el teléfono. */}
        <div className="border-b border-border px-3 py-3 md:hidden">
          <CompanySwitcher variant="mobile" />
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const { href, label, Icon, children } = item;
                  const active = pathname === href || pathname.startsWith(`${href}/`);

                  if (!children) {
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={onCloseMobile}
                        className={linkCls(active)}
                        aria-current={active ? "page" : undefined}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {label}
                      </Link>
                    );
                  }

                  // Ítem con sub-ítems (Pagar). Se despliega cuando la sección está
                  // activa: alguna ruta /pagar/* o /remuneraciones (Remuneraciones
                  // vive fuera de /pagar pero es su sub-ítem).
                  const subs = children.filter((c) => !c.needsRemun || remuneracionesEnabled);
                  // Un hijo se activa por su ruta; el hijo-índice (href === el del
                  // padre, ej. "Resultado del mes" = /gestion) SOLO por match exacto
                  // (si no, se prendería en /gestion/margenes también).
                  const childMatch = (c: SubLink) =>
                    pathname === c.href || (c.href !== href && pathname.startsWith(`${c.href}/`));
                  const expanded = pathname.startsWith(href) || subs.some(childMatch);
                  // Si un sub-ítem "posee" la ruta exacta (ej. Resultado del mes = /gestion),
                  // no doble-resaltamos el padre.
                  const parentActive = pathname === href && !subs.some((c) => pathname === c.href);
                  return (
                    <div key={href}>
                      <Link
                        href={href}
                        onClick={onCloseMobile}
                        className={linkCls(parentActive)}
                        aria-current={parentActive ? "page" : undefined}
                        aria-expanded={expanded}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        <span className="flex-1">{label}</span>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 shrink-0 transition-transform",
                            expanded ? "rotate-0" : "-rotate-90",
                          )}
                          aria-hidden="true"
                        />
                      </Link>
                      {expanded && subs.length > 0 && (
                        <div className="mt-1 space-y-1 border-l border-border pl-3 ml-4">
                          {subs.map((c) => {
                            const cActive = childMatch(c);
                            return (
                              <Link
                                key={c.href}
                                href={c.href}
                                onClick={onCloseMobile}
                                className={cn(
                                  "block rounded-lg px-3 py-1.5 text-sm transition-all",
                                  cActive
                                    ? "bg-brand-primary-50 font-medium text-brand-primary-700"
                                    : "text-neutral-mid hover:bg-brand-primary-50 hover:text-brand-primary-700",
                                )}
                                aria-current={cActive ? "page" : undefined}
                              >
                                {c.label}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
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
