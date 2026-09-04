import * as React from "react";
import { Activity, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/* PulsoTira — el Pulso del negocio como TIRA delgada (no un número gigante): el score ya vive
   en el header y tiene su página de detalle, así que acá va compacto, solo por el insight que
   suma (la tensión resultado devengado vs. caja). Es el MISMO Pulso del header/Inicio (misma
   fuente). Enlaza a su detalle en /alertas. */

/* `neutral` es el "no sabemos" de la API (qavante-api#162), y NO es un `warn` suavizado:
   inventar una mala noticia es el error simetrico de inventar una buena. Las otras cuatro
   superficies del Pulso ya van a `neutral-mid` en ese caso; esta se habia quedado en ambar
   heredando el `UNKNOWN_PULSO_STATE` preexistente. */
export type PulsoTono = "ok" | "warn" | "bad" | "neutral";

export interface PulsoTiraProps {
  /** Score del Pulso (0-100). El mismo del header. */
  /** `null` cuando la API se abstiene: sin saldo de apertura el Pulso es preliminar
   *  (qavante-api#162). Se pinta un guion, NO un cero: un 0 en un indice 0-100 se lee
   *  como el peor pulso posible, que es exactamente lo que no se sabe. */
  score: number | null;
  /** Etiqueta del estado (ej. "Pulso débil"). */
  estado: string;
  /** Tono del estado. Default "warn". */
  tono?: PulsoTono;
  /** El insight (ej. la tensión resultado vs. caja). */
  insight: React.ReactNode;
  /** Texto del link a detalle. Default "Ver por qué". */
  verLabel?: string;
  onVer?: () => void;
  className?: string;
}

const TONO: Record<PulsoTono, string> = {
  ok: "text-success-700 bg-success-500/10",
  warn: "text-warning-700 bg-warning-500/10",
  bad: "text-danger-500 bg-danger-500/10",
  neutral: "text-neutral-mid bg-neutral-mid/10",
};

const NUM: Record<PulsoTono, string> = {
  ok: "text-success-700",
  warn: "text-warning-700",
  bad: "text-danger-500",
  neutral: "text-neutral-mid",
};

export function PulsoTira({
  score,
  estado,
  tono = "warn",
  insight,
  verLabel = "Ver por qué",
  onVer,
  className,
}: PulsoTiraProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-surface px-4 py-3 shadow-sm",
        className,
      )}
    >
      <span className="inline-flex shrink-0 items-center gap-2">
        <Activity className={cn("size-4", NUM[tono])} aria-hidden="true" />
        <span className={cn("text-[19px] font-extrabold tabular-nums", NUM[tono])}>
          {score ?? "·"}
        </span>
        <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-bold", TONO[tono])}>
          {estado}
        </span>
      </span>
      <span className="min-w-[220px] flex-1 text-[12.5px] text-neutral-dark">{insight}</span>
      <button
        type="button"
        onClick={onVer}
        className="ml-auto inline-flex shrink-0 items-center gap-1 text-[12px] font-bold text-brand-primary transition-colors hover:text-brand-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
      >
        {verLabel}
        <ChevronRight className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
