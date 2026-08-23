import * as React from "react";
import { cn } from "@/lib/utils";

/* Chrome/nav superior — ESPECIFICACION.md §1.3 "Chrome/nav superior" (`.chrome`).
 * Fija. Items: Hoy · Caja · Banco · Cobrar · Pagar · Impuestos · Gestión ·
 * Presupuesto. Derecha: badge "Bandeja · N", campana "🔔 N" (solo alertas
 * críticas accionables), avatar. Activo: bold + underline 2px tinta.
 *
 * Deliberadamente aislado, sin tocar `src/components/shell/` (sidebar+header
 * de dos piezas, arquitectura muy distinta — ver hallazgo del mapeo de
 * qavante-web#33: migrar de sidebar vertical a chrome horizontal único es un
 * cambio de layout que afecta TODA la app, no algo para hacer sin que alguien
 * revise el resultado en vivo). Este componente es la referencia visual lista
 * para cablearse cuando Fase 2 decida el momento del corte. */

export interface ChromeNavItem {
  label: string;
  href: string;
}

export interface ChromeProps {
  items: ReadonlyArray<ChromeNavItem>;
  /** href del item activo. */
  activeHref: string;
  /** Excepciones pendientes en la Bandeja (conteo total, no solo críticas). */
  bandejaCount: number;
  /** SOLO alertas críticas accionables — nunca el total de alertas (Ley 2). */
  criticalAlertCount: number;
  /** Iniciales del usuario para el avatar. */
  userInitials: string;
  /** `active` va incluido para que el consumidor (ej. `next/link` en Fase 2)
   *  pueda replicar `aria-current="page"` en su propio wrapper — sin esto el
   *  estado activo queda solo visual y se pierde para lectores de pantalla. */
  renderLink?: (item: ChromeNavItem, active: boolean, children: React.ReactNode) => React.ReactNode;
}

export function Chrome({
  items,
  activeHref,
  bandejaCount,
  criticalAlertCount,
  userInitials,
  renderLink,
}: ChromeProps) {
  return (
    <header className="flex items-center gap-3 border-b border-rediseno-hairline bg-rediseno-porcelana px-[34px] py-[15px]">
      <span className="mr-2 font-rediseno-serif text-[17px] font-semibold text-rediseno-tinta">
        Qavante
      </span>
      <nav
        aria-label="Principal"
        className="flex flex-wrap gap-[17px] text-[13px] font-medium text-rediseno-tinta-3"
      >
        {items.map((item) => {
          const active = item.href === activeHref;
          const label = (
            <span
              className={cn(
                active && "border-b-2 border-rediseno-tinta pb-0.5 font-bold text-rediseno-tinta",
              )}
            >
              {item.label}
            </span>
          );
          return (
            <React.Fragment key={item.href}>
              {renderLink ? (
                renderLink(item, active, label)
              ) : (
                <a href={item.href} aria-current={active ? "page" : undefined}>
                  {label}
                </a>
              )}
            </React.Fragment>
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-[13px] text-xs text-rediseno-tinta-3">
        <a
          href="/bandeja"
          className="rounded-full bg-rediseno-neutro-bg px-[11px] py-1 text-[11.5px] font-bold text-rediseno-tinta"
        >
          Bandeja · {bandejaCount}
        </a>
        <a
          href="/alertas"
          aria-label={`${criticalAlertCount} alertas críticas`}
          className={cn(
            "rounded-full px-[11px] py-1 text-[11.5px] font-bold",
            criticalAlertCount > 0
              ? "bg-rediseno-rojo-soft text-rediseno-rojo"
              : "bg-rediseno-neutro-bg text-rediseno-tinta",
          )}
        >
          🔔 {criticalAlertCount}
        </a>
        <span
          aria-hidden
          className="flex size-[29px] items-center justify-center rounded-full bg-rediseno-tinta text-[11px] font-bold text-white"
        >
          {userInitials}
        </span>
      </div>
    </header>
  );
}
