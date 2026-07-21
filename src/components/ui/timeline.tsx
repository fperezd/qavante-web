import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/* Timeline / stepper vertical — el "seguimiento" de un ciclo de vida (conciliación,
 * pago, clasificación de un movimiento). Cada paso: hecho (✓), en curso (anillo) o
 * pendiente (hueco), con título y detalle (quién/cuándo). Reusable. */

export type TimelineStatus = "done" | "current" | "pending";

export interface TimelineStep {
  status: TimelineStatus;
  title: string;
  /** Detalle del paso (quién/cuándo/cómo). */
  children?: React.ReactNode;
}

function Dot({ status }: { status: TimelineStatus }) {
  if (status === "done") {
    return (
      <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-success-500 text-surface">
        <Check className="h-3 w-3" aria-hidden="true" strokeWidth={3} />
      </span>
    );
  }
  if (status === "current") {
    return (
      <span className="grid h-[18px] w-[18px] place-items-center rounded-full border-2 border-brand-primary bg-surface shadow-[0_0_0_3px] shadow-brand-primary/20">
        <span className="animate-qv-breathe h-1.5 w-1.5 rounded-full bg-brand-primary" />
      </span>
    );
  }
  return (
    <span className="h-[18px] w-[18px] rounded-full border border-neutral-mid/40 bg-surface" />
  );
}

const STATUS_LABEL: Record<TimelineStatus, string> = {
  done: "completado",
  current: "en curso",
  pending: "pendiente",
};

export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="space-y-5">
      {steps.map((s, i) => (
        <li key={i} className="relative pl-7">
          {/* Línea vertical entre puntos (no en el último). Tras un paso completado, se pinta con
              un gradiente verde (progreso recorrido); si no, neutra. */}
          {i < steps.length - 1 && (
            <span
              className={cn(
                "absolute left-[8px] top-5 h-[calc(100%+4px)] w-px",
                s.status === "done"
                  ? "bg-gradient-to-b from-success-500 to-success-500/25"
                  : "bg-border",
              )}
              aria-hidden="true"
            />
          )}
          <span className="absolute left-0 top-0.5">
            <Dot status={s.status} />
          </span>
          <p
            className={cn(
              "text-sm font-semibold",
              s.status === "pending" ? "text-neutral-mid" : "text-neutral-dark",
              s.status === "done" && "text-success-700",
            )}
          >
            {s.title}
            <span className="sr-only"> ({STATUS_LABEL[s.status]})</span>
          </p>
          {s.children != null && (
            <div className="mt-0.5 text-xs leading-relaxed text-neutral-mid">{s.children}</div>
          )}
        </li>
      ))}
    </ol>
  );
}
