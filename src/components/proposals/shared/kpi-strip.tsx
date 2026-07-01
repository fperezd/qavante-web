import * as React from "react";
import { QavanteCard } from "@/components/qavante";
import { cn } from "@/lib/utils";

/* Tira compacta de KPIs — una sola tarjeta con celdas divididas, mucho más densa
 * que N tarjetas grandes. Usada por los prototipos de propuesta para no gastar
 * medio viewport en 4 números. */

export function KpiStrip({ children, className }: { children: React.ReactNode; className?: string }) {
  const cols = React.Children.count(children);
  return (
    <QavanteCard variant="bordered" className={cn("p-0", className)}>
      <div
        className={cn(
          "grid grid-cols-2 sm:divide-x sm:divide-border",
          cols >= 4 ? "sm:grid-cols-4" : cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
        )}
      >
        {children}
      </div>
    </QavanteCard>
  );
}

export function KpiCell({
  label,
  value,
  valueClassName,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="px-4 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">{label}</p>
      <p className={cn("mt-0.5 text-lg font-bold tabular-nums text-neutral-dark", valueClassName)}>{value}</p>
      {sub != null && <div className="mt-0.5 text-xs text-neutral-mid">{sub}</div>}
    </div>
  );
}
