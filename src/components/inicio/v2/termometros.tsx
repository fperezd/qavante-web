import * as React from "react";
import { cn } from "@/lib/utils";

/* Termómetros (Inicio Ejecutivo v2). Las 3 preguntas del dueño en tercera persona
   (¿La caja cubre la operación? · ¿La empresa está ganando dinero? · ¿…ingresos
   futuros…?), cada una con estado y respuesta. La de continuidad puede quedar
   destacada/fijada (baranda: nunca se oculta). Presentacional puro. */

export type PillTono = "crit" | "warn" | "ok" | "neutral";
/** Franja lateral: rojo = crítico, verde = sano, azul = foco elegido (control). */
export type Destacado = "crit" | "ok" | "focus" | "none";

const PILL_CLASS: Record<PillTono, string> = {
  crit: "bg-danger-50 text-danger-500",
  warn: "bg-warning-50 text-warning-700",
  ok: "bg-success-50 text-success-700",
  neutral: "bg-surface-muted text-neutral-mid",
};

const STRIPE_CLASS: Record<Destacado, string> = {
  crit: "before:bg-danger-500 border-danger-500/60",
  ok: "before:bg-success-500 border-success-500/60",
  focus: "before:bg-brand-primary border-brand-primary/60",
  none: "",
};

export interface Termometro {
  n: number;
  pregunta: string;
  pill: string;
  pillTono: PillTono;
  respuesta: React.ReactNode;
  masLabel: string;
  /** Ruta del "ver más". Sin href → queda como texto (hint), no link. */
  masHref?: string;
  destacado?: Destacado;
}

export interface TermometrosProps {
  items: Termometro[];
  className?: string;
}

export function Termometros({ items, className }: TermometrosProps) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-3", className)}>
      {items.map((t) => {
        const dest = t.destacado ?? "none";
        return (
          <section
            key={t.n}
            className={cn(
              "relative flex flex-col gap-2 overflow-hidden rounded-xl border border-border bg-surface p-4 shadow-sm",
              "before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']",
              STRIPE_CLASS[dest],
            )}
          >
            <p className="text-[13px] font-bold leading-tight text-neutral-dark">
              <span className="mr-1.5 font-extrabold text-neutral-mid">{t.n}</span>
              {t.pregunta}
            </p>
            <span
              className={cn(
                "inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                PILL_CLASS[t.pillTono],
              )}
            >
              {t.pill}
            </span>
            <p className="text-xs leading-relaxed text-neutral-mid">{t.respuesta}</p>
            {t.masHref ? (
              <a href={t.masHref} className="mt-1 text-xs font-semibold text-brand-primary">
                {t.masLabel}
              </a>
            ) : (
              <span className="mt-1 text-xs font-semibold text-brand-primary">{t.masLabel}</span>
            )}
          </section>
        );
      })}
    </div>
  );
}
