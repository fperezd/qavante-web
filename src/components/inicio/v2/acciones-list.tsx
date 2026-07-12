import * as React from "react";
import { cn } from "@/lib/utils";

/* AccionesList (Inicio Ejecutivo v2). La lista de acciones para los escenarios que
   NO son crisis (sana / control de gestión), donde no hay una brecha que cerrar sino
   oportunidades o hallazgos de gestión. Cada acción con su plazo y CTA; un "pin"
   opcional fija la continuidad abajo (baranda: nunca se oculta). Presentacional puro.

   En crisis se usa BrechaPlan (plan cuantificado); acá, verbos ordenados por impacto
   con dato que sale del SII + banco (sin margen por cliente ni CRM). */

export type PlazoTono = "hot" | "warn" | "neutral";

const PLAZO_TEXT: Record<PlazoTono, string> = {
  hot: "text-danger-500",
  warn: "text-warning-700",
  neutral: "text-neutral-mid",
};

export interface Accion {
  rank: number;
  titulo: string;
  detalle: React.ReactNode;
  plazo: string;
  plazoTono?: PlazoTono;
  cta: string;
  /** Ruta a la que navega el CTA (de `priority_action.cta_href`). Sin href → botón inerte. */
  href?: string;
  /** Marca la acción como crítica (rank en rojo). */
  critica?: boolean;
}

const CTA_CLASS =
  "mt-1 shrink-0 self-center whitespace-nowrap rounded-lg border border-border-strong bg-surface px-3 py-1.5 text-[13px] font-semibold text-brand-primary";

export interface AccionesListProps {
  titulo: string;
  acciones: Accion[];
  /** Nota fijada al pie (p.ej. continuidad en el lente de control de gestión). */
  pin?: { texto: React.ReactNode; cta: string };
  className?: string;
}

export function AccionesList({ titulo, acciones, pin, className }: AccionesListProps) {
  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm",
        className,
      )}
      aria-label={titulo}
    >
      <h3 className="px-5 pb-2.5 pt-4 text-[11px] font-bold uppercase tracking-wider text-neutral-mid">
        {titulo}
      </h3>

      <ol className="flex-1">
        {acciones.map((a) => (
          <li key={a.rank} className="flex items-start gap-3.5 border-t border-border px-5 py-3">
            <span
              className={cn(
                "grid h-6 w-6 shrink-0 place-items-center rounded-lg border text-xs font-extrabold",
                a.critica
                  ? "border-danger-500 bg-danger-500 text-surface"
                  : "border-border bg-surface-muted text-neutral-mid",
              )}
            >
              {a.rank}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-neutral-dark">{a.titulo}</p>
              <p className="mt-0.5 text-[13px] text-neutral-mid">{a.detalle}</p>
              <span
                className={cn(
                  "mt-1 inline-block text-[11px] font-bold uppercase tracking-wide",
                  PLAZO_TEXT[a.plazoTono ?? "neutral"],
                )}
              >
                {a.plazo}
              </span>
            </div>
            {a.href ? (
              <a href={a.href} className={CTA_CLASS}>
                {a.cta}
              </a>
            ) : (
              <button type="button" className={CTA_CLASS}>
                {a.cta}
              </button>
            )}
          </li>
        ))}
      </ol>

      {pin && (
        <div className="flex items-center justify-between gap-2.5 border-t border-border bg-danger-500/10 px-5 py-3">
          <span className="text-[13px] font-semibold text-neutral-dark">{pin.texto}</span>
          <button
            type="button"
            className="shrink-0 whitespace-nowrap rounded-lg border border-border-strong bg-surface px-3 py-1.5 text-[13px] font-semibold text-brand-primary"
          >
            {pin.cta}
          </button>
        </div>
      )}
    </section>
  );
}
