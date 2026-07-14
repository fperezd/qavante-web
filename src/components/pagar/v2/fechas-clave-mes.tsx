import * as React from "react";
import { ShieldCheck, Receipt, Users, ChevronRight } from "lucide-react";
import { formatClp } from "@/lib/formatters/clp";

/* FechasClaveMes — las 3 obligaciones canónicas del mes de una PYME chilena: imposiciones
   (Previred), impuestos (F29/IVA) y sueldos. Las que NO se postergan. Van destacadas en su
   propio bloque, no perdidas en la lista. Presentacional; cada una clickeable → su detalle.
   Alimentado por `key_obligations` (el mismo dato del Inicio v2). */

export type FechaClaveIcono = "imposiciones" | "impuestos" | "sueldos";

export interface FechaClave {
  id: string;
  label: string;
  monto: number;
  /** Fecha de vencimiento legible (ej. "13-jul"). */
  vence: string;
  /** Días hasta el vencimiento (para "en N días"; ≤2 se resalta). */
  enDias?: number;
  icono?: FechaClaveIcono;
  onClick?: () => void;
}

export interface FechasClaveMesProps {
  titulo?: string;
  items: FechaClave[];
  /** Suma de las obligaciones (opcional). */
  total?: number;
  className?: string;
}

const ICONO: Record<FechaClaveIcono, React.ComponentType<{ className?: string }>> = {
  imposiciones: ShieldCheck,
  impuestos: Receipt,
  sueldos: Users,
};

export function FechasClaveMes({
  titulo = "Las 3 del mes · no se postergan",
  items,
  total,
  className,
}: FechasClaveMesProps) {
  return (
    <section className={className} aria-label={titulo}>
      <div className="mb-2 flex items-baseline justify-between gap-3 px-0.5">
        <span className="text-[11.5px] font-bold uppercase tracking-wide text-neutral-mid">{titulo}</span>
        {total != null && (
          <span className="text-[12.5px] text-neutral-mid">
            Suman <b className="font-bold tabular-nums text-neutral-dark">{formatClp(total)}</b>
          </span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {items.map((it) => {
          const Icon = ICONO[it.icono ?? "impuestos"];
          const soon = it.enDias != null && it.enDias <= 2;
          return (
            <button
              key={it.id}
              type="button"
              onClick={it.onClick}
              className="group relative rounded-xl border border-border border-l-[3px] border-l-brand-primary bg-surface p-3.5 pr-8 text-left shadow-sm transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              <ChevronRight className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-light group-hover:text-brand-primary" aria-hidden="true" />
              <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-neutral-dark">
                <Icon className="size-4 shrink-0 text-brand-primary" />
                {it.label}
              </span>
              <span className="mt-1.5 block text-[21px] font-extrabold tabular-nums text-neutral-dark">
                {formatClp(it.monto)}
              </span>
              <span className="mt-0.5 block text-[12px] text-neutral-mid">
                Vence <b className="text-neutral-dark">{it.vence}</b>
                {it.enDias != null && (
                  <>
                    {" · "}
                    <span className={soon ? "font-bold text-danger-500" : ""}>en {it.enDias} día{it.enDias === 1 ? "" : "s"}</span>
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
