import * as React from "react";
import { cn } from "@/lib/utils";

/* Tarjeta KPI — ESPECIFICACION.md §1.3 "Tarjeta KPI" (`.kp` en `.kpi3/.k4/.k5`).
 * Label mono uppercase + valor Fraunces + detalle. Selector de período opcional
 * (`.per`) a la derecha del label. Cifras SIEMPRE con `tabular-nums` (§1.2). */

export interface KpiCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  /** Chip de período a la derecha del label, ej. "BICE · 00:12 ✓" o "14 días ▾". */
  period?: string;
  value: React.ReactNode;
  /** ok = verde, bad = rojo (Ley 2: rojo solo crítico y accionable). */
  tone?: "default" | "ok" | "bad";
  detail?: React.ReactNode;
}

export function KpiCard({
  label,
  period,
  value,
  tone = "default",
  detail,
  className,
  ...props
}: KpiCardProps) {
  return (
    <div
      className={cn(
        "rounded-[14px] border border-rediseno-hairline bg-rediseno-superficie px-[17px] py-3.5",
        className,
      )}
      {...props}
    >
      <div className="flex items-baseline gap-2 font-rediseno-mono text-[10px] tracking-[.1em] text-rediseno-tinta-3-light uppercase">
        <span>{label}</span>
        {period && (
          <span className="ml-auto rounded-md bg-rediseno-porcelana px-[7px] py-px font-rediseno-sans text-[11px] tracking-normal text-rediseno-tinta-3 normal-case">
            {period}
          </span>
        )}
      </div>
      <div
        className={cn(
          "mt-1.5 font-rediseno-serif text-[21px] font-medium tabular-nums",
          tone === "ok" && "text-rediseno-verde",
          tone === "bad" && "text-rediseno-rojo",
          tone === "default" && "text-rediseno-tinta",
        )}
      >
        {value}
      </div>
      {detail && <div className="mt-0.5 text-[11.5px] text-rediseno-tinta-3-light">{detail}</div>}
    </div>
  );
}
