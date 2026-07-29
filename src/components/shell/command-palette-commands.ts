import {
  Home,
  Banknote,
  ArrowDownToLine,
  ArrowUpFromLine,
  LineChart,
  Users,
  Settings,
  UserCircle,
  Inbox,
  CheckCircle2,
  TrendingUp,
  FileOutput,
  FileInput,
  Briefcase,
  Receipt,
  Landmark,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/lib/auth/types";

/* Catálogo de comandos + lógica de filtrado del command palette (⌘K). PURO (sin
   JSX/React) para testear el filtrado sin montar el diálogo. El componente
   consume esto. */

export interface Command {
  id: string;
  label: string;
  group: string;
  href: string;
  Icon: LucideIcon;
  /** Términos alternativos para el match (ej. "iva" → F29, "sueldos" → Remun.). */
  keywords?: string;
  /** Solo visible para estos roles (undefined = todos). */
  roles?: ReadonlyArray<UserRole>;
}

export const ADMIN_ROLES: ReadonlyArray<UserRole> = ["owner", "admin", "technical_admin"];

/** Catálogo de destinos. El orden acá es el de aparición dentro de cada grupo. */
export const COMMANDS: ReadonlyArray<Command> = [
  {
    id: "inicio",
    label: "Inicio",
    group: "Ir a",
    href: "/inicio",
    Icon: Home,
    keywords: "dashboard resumen pulso",
  },
  {
    id: "caja",
    label: "Caja",
    group: "Ir a",
    href: "/caja",
    Icon: Banknote,
    keywords: "flujo tesoreria",
  },
  {
    id: "cobrar",
    label: "Cobrar",
    group: "Ir a",
    href: "/cobrar",
    Icon: ArrowDownToLine,
    keywords: "cuentas por cobrar deudores",
  },
  {
    id: "pagar",
    label: "Pagar",
    group: "Ir a",
    href: "/pagar",
    Icon: ArrowUpFromLine,
    keywords: "cuentas por pagar proveedores",
  },
  {
    id: "gestion",
    label: "Gestión",
    group: "Ir a",
    href: "/gestion",
    Icon: LineChart,
    keywords: "resultado operacional",
  },
  {
    id: "remuneraciones",
    label: "Remuneraciones",
    group: "Ir a",
    href: "/remuneraciones",
    Icon: Users,
    keywords: "sueldos planilla dotacion buk equipo",
  },
  {
    id: "mi-cuenta",
    label: "Mi cuenta",
    group: "Ir a",
    href: "/mi-cuenta",
    Icon: UserCircle,
    keywords: "perfil cerrar sesion salir",
  },
  {
    id: "admin",
    label: "Administración",
    group: "Ir a",
    href: "/administracion",
    Icon: Settings,
    keywords: "usuarios estructura credenciales",
    roles: ADMIN_ROLES,
  },

  {
    id: "por-clasificar",
    label: "Movimientos por clasificar",
    group: "Tesorería",
    href: "/caja/por-clasificar",
    Icon: Inbox,
    keywords: "clasificar banco conciliar",
  },
  {
    id: "clasificados",
    label: "Movimientos clasificados",
    group: "Tesorería",
    href: "/caja/clasificados",
    Icon: CheckCircle2,
    keywords: "auditoria clasificados",
  },
  {
    id: "proyeccion",
    label: "Caja proyectada",
    group: "Tesorería",
    href: "/caja/proyeccion",
    Icon: TrendingUp,
    keywords: "flujo proyeccion brecha",
  },
  {
    id: "previred",
    label: "Previred",
    group: "Tesorería",
    href: "/pagar/previred",
    Icon: ShieldCheck,
    keywords: "imposiciones cotizaciones afp salud cesantia previsional",
  },
  {
    id: "obligaciones",
    label: "Préstamos y obligaciones",
    group: "Tesorería",
    href: "/pagar/obligaciones",
    Icon: Landmark,
    keywords: "prestamos cuotas amortizacion",
  },

  {
    id: "ventas",
    label: "Facturas de venta",
    group: "SII",
    href: "/cobrar/facturas-emitidas",
    Icon: FileOutput,
    keywords: "sii ventas facturas emitidas libro rcv",
  },
  {
    id: "compras",
    label: "Facturas de compra",
    group: "SII",
    href: "/pagar/facturas-recibidas",
    Icon: FileInput,
    keywords: "sii compras facturas recibidas libro rcv",
  },
  {
    id: "honorarios",
    label: "Honorarios recibidos (BHE)",
    group: "SII",
    href: "/pagar/honorarios-recibidos",
    Icon: Briefcase,
    keywords: "bhe boletas honorarios retencion",
  },
  {
    id: "f29",
    label: "Impuestos Mensuales",
    group: "SII",
    href: "/pagar/impuestos/f29",
    Icon: Receipt,
    keywords: "f29 impuestos iva ppm declaracion mensual",
  },
  {
    id: "pulso",
    label: "Pulso Empresa",
    group: "SII",
    href: "/gestion/pulso",
    Icon: LineChart,
    keywords: "salud indice",
  },
];

/** ¿El comando matchea la query? Tolerante: por label, grupo y keywords, con
 *  múltiples términos en AND (sin importar el orden). Query vacía → true. */
export function matches(
  cmd: { label: string; group: string; keywords?: string },
  q: string,
): boolean {
  if (!q) return true;
  const haystack = `${cmd.label} ${cmd.group} ${cmd.keywords ?? ""}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

/** Comandos visibles para un rol (filtra los `roles`-gated). */
export function visibleCommands(userRole: UserRole | undefined): ReadonlyArray<Command> {
  return COMMANDS.filter((c) => !c.roles || (userRole && c.roles.includes(userRole)));
}
