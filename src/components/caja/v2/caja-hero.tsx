import * as React from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { AmountCountUp } from "@/components/qavante/amount-count-up";
import { InfoHint } from "@/components/ui/info-hint";

/* CajaHero — la "respuesta de dueño" del Caja v2: cuánta caja hay + cuánto dura + cuándo
   toca piso, en 3ª persona. Presentacional (recibe el saldo y la línea de runway ya
   armada). Baranda: es el mensaje central, no se mueve ni se oculta. */

export type RunwayTono = "ok" | "warn" | "crit";

export interface CajaHeroProps {
  /** Antetítulo, ej. "La empresa tiene en caja". */
  titulo: string;
  /** Saldo total disponible hoy. */
  saldo: number;
  /** Línea de runway ("Alcanza ~4 semanas · el 11-ago cae bajo tu mínimo"). `null` la oculta —
   *  cuando el medidor de días de caja (Caja v3) ya cuenta ese mismo estado abajo, no se repite. */
  runway?: React.ReactNode;
  /** Tono de la línea de runway (color + ícono). Default "ok". */
  runwayTono?: RunwayTono;
  /** Pie del número de oro (ej. "Saldo hoy en banco"). */
  subtitulo?: React.ReactNode;
  infoHint?: React.ReactNode;
  className?: string;
}

const TONO: Record<RunwayTono, string> = {
  ok: "text-success-700",
  warn: "text-warning-700",
  crit: "text-danger-500",
};

export function CajaHero({
  titulo,
  saldo,
  runway,
  runwayTono = "ok",
  subtitulo,
  infoHint,
  className,
}: CajaHeroProps) {
  const Icon = runwayTono === "ok" ? CheckCircle2 : AlertTriangle;
  return (
    <div className={cn("p-5", className)}>
      <p className="text-[11.5px] font-bold uppercase tracking-wide text-neutral-mid">{titulo}</p>
      <p
        className={cn(
          "mt-1.5 text-[33px] font-extrabold leading-none tracking-tight tabular-nums",
          // Caja en negativo → el número mismo va en rojo (no un dato neutro más).
          saldo < 0 ? "text-danger-500" : "text-neutral-dark",
        )}
      >
        <AmountCountUp value={saldo} />
      </p>
      {runway != null && (
        <div
          className={cn("mt-3 flex items-start gap-2 text-[13px] font-semibold", TONO[runwayTono])}
        >
          <Icon className="mt-px size-[18px] shrink-0" aria-hidden="true" />
          <span>{runway}</span>
        </div>
      )}
      {subtitulo != null && (
        <p className={cn("text-[12.5px] text-neutral-mid", runway != null ? "mt-2.5" : "mt-3")}>
          {subtitulo}
          {infoHint ? (
            <>
              {" "}
              <InfoHint label="Qué significa esta cifra">{infoHint}</InfoHint>
            </>
          ) : null}
        </p>
      )}
    </div>
  );
}
