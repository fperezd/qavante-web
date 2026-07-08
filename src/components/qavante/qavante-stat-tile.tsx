import * as React from "react";
import { cn } from "@/lib/utils";
import { InfoHint } from "@/components/ui/info-hint";
import { QavanteCard } from "./qavante-card";

/* Tile de KPI unificado (Ola 2 · sistema de diseño). Reemplaza los `Metric`/
   `InfoCard` locales que cada pantalla de dinero reinventaba con tamaños
   distintos (text-lg vs text-xl…). Un solo tratamiento del número → "el número
   grande arriba" se ve y pesa igual en toda la app, generando memoria muscular.
   `tabular-nums` siempre: las cifras no "bailan" al actualizarse. El color del
   valor comunica significado (positivo/negativo/alerta), no decora. */

const TONE: Record<string, string> = {
  default: "text-neutral-dark",
  danger: "text-danger-500",
  success: "text-success-700",
  muted: "text-neutral-mid",
};

export interface QavanteStatTileProps {
  /** Etiqueta corta en mayúsculas (ej. "Total por cobrar"). */
  label: string;
  /** Valor principal — normalmente un monto ya formateado (`formatClp`). */
  value: React.ReactNode;
  /** Color del valor según su significado. `default` = neutro. */
  tone?: "default" | "danger" | "success" | "muted";
  /** Tamaño del valor. `kpi` (default) para tiles de resumen; `hero` para el
   *  número protagonista de una pantalla. */
  size?: "kpi" | "hero";
  /** Línea de apoyo bajo el valor (frescura, nota). Opcional. */
  hint?: React.ReactNode;
  /** Explica la cifra en lenguaje de dueño; muestra un ⓘ accesible junto a la
   *  etiqueta (abre al hover y al foco de teclado). Opcional. */
  info?: React.ReactNode;
  className?: string;
}

export function QavanteStatTile({
  label,
  value,
  tone = "default",
  size = "kpi",
  hint,
  info,
  className,
}: QavanteStatTileProps) {
  return (
    <QavanteCard variant="bordered" className={className}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
        {label}
        {info != null && <InfoHint label={`Qué significa ${label}`}>{info}</InfoHint>}
      </p>
      <p
        className={cn(
          "mt-1 font-bold tabular-nums",
          size === "hero" ? "text-3xl tracking-tight" : "text-xl",
          TONE[tone],
        )}
      >
        {value}
      </p>
      {hint && <div className="mt-1.5 text-xs text-neutral-mid">{hint}</div>}
    </QavanteCard>
  );
}
