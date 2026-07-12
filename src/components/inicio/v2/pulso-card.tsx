import * as React from "react";
import { cn } from "@/lib/utils";
import { PulsoRing } from "@/components/inicio/pulso-ring";
import { Sparkline, type SparkTone } from "@/components/ui/sparkline";
import type { PulsoStatus } from "@/lib/api/dashboard";

/* PulsoCard (Inicio Ejecutivo v2). El anillo del Pulso (marca — NO se renombra)
   centrado, con el header centrado arriba (label + confianza + factores) y la
   tendencia de 30 días abajo: el score deja de ser un número suelto. Presentacional
   puro; la serie de tendencia llega del snapshot (q_score, ADR-0064). */

export type FactorTono = "ok" | "warn" | "crit";

const FACTOR_DOT: Record<FactorTono, string> = {
  ok: "bg-success-500",
  warn: "bg-warning-500",
  crit: "bg-danger-500",
};

/** Tono del sparkline según el estado canónico del Pulso. */
const SPARK_TONE: Record<PulsoStatus, SparkTone> = {
  strong: "success",
  stable: "success",
  weak: "neutral",
  critical: "danger",
};

const DELTA_TEXT: Record<PulsoStatus, string> = {
  strong: "text-success-700",
  stable: "text-success-700",
  weak: "text-warning-700",
  critical: "text-danger-500",
};

function statusValue<T>(rec: Record<PulsoStatus, T>, status: PulsoStatus): T {
  return (rec as Record<string, T>)[status] ?? rec.stable;
}

export interface PulsoFactor {
  label: string;
  tono: FactorTono;
}

export interface PulsoCardProps {
  score: number;
  status: PulsoStatus;
  /** "Confianza de los datos: alta". */
  confianza: string;
  factores: PulsoFactor[];
  /** Serie de ~30 días para el sparkline de tendencia. */
  tendencia: number[];
  /** "▼ de 58 a 33 en 30 días". */
  delta: string;
  className?: string;
}

export function PulsoCard({
  score,
  status,
  confianza,
  factores,
  tendencia,
  delta,
  className,
}: PulsoCardProps) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-xl border border-border bg-surface p-5 shadow-sm",
        className,
      )}
      aria-label="Pulso del negocio"
    >
      <div className="text-center">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-mid">
            Pulso del negocio
          </span>
          <span className="text-xs text-neutral-mid">🛡️ {confianza}</span>
        </div>
        {factores.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {factores.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-2.5 py-1 text-[11px] font-semibold text-neutral-mid"
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", FACTOR_DOT[f.tono])} />
                {f.label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-1 items-center justify-center py-4">
        <PulsoRing score={score} status={status} />
      </div>

      {/* La tendencia se muestra solo si hay serie (≥2 puntos): la serie de 30d
          del Pulso (q_score) llega con el flip v2 — hasta entonces se omite el
          bloque en vez de mostrar un caption vacío sin gráfico. */}
      {tendencia.length >= 2 && (
        <div className="border-t border-border pt-3">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[11px] font-semibold text-neutral-mid">
              Continuidad · últimos 30 días
            </span>
            <span className={cn("text-xs font-bold", statusValue(DELTA_TEXT, status))}>
              {delta}
            </span>
          </div>
          <Sparkline
            data={tendencia}
            tone={statusValue(SPARK_TONE, status)}
            width={320}
            height={44}
            className="w-full"
          />
        </div>
      )}
    </section>
  );
}
