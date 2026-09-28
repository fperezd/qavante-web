import * as React from "react";
import { CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { AmountCountUp } from "@/components/qavante/amount-count-up";
import { InfoHint } from "@/components/ui/info-hint";
import { MONTO_EN_REVISION, MONTO_EN_REVISION_MOTIVO } from "@/lib/formatters/amount";

/* PagarHero — la "respuesta de dueño" de Pagar v2: cuánto debe pagar + la respuesta que
   importa (¿la caja alcanza?). Pagar mira ADELANTE (compromiso futuro + cobertura), por
   eso no lleva sparkline. Presentacional; la cobertura llega ya armada. Baranda. */

export type CoberturaTono = "ok" | "bad" | "neutral";

export interface PagarHeroProps {
  /** Antetítulo, ej. "La empresa debe pagar". */
  titulo: string;
  /** Total por pagar (CLP). `null` = en revisión de conciliación (qavante-api#907): se dice,
   *  nunca se pinta $0. */
  montoTotal: number | null;
  /** Señal tri-estado de cobertura informada por la API, sin monto derivado localmente. */
  cobertura: React.ReactNode;
  /** Tono de la cobertura. Default "ok". */
  coberturaTono?: CoberturaTono;
  subtitulo?: React.ReactNode;
  infoHint?: React.ReactNode;
  className?: string;
}

export function PagarHero({
  titulo,
  montoTotal,
  cobertura,
  coberturaTono = "ok",
  subtitulo,
  infoHint,
  className,
}: PagarHeroProps) {
  const Icon =
    coberturaTono === "ok"
      ? CheckCircle2
      : coberturaTono === "neutral"
        ? HelpCircle
        : AlertTriangle;
  return (
    <div className={cn("p-5", className)}>
      <p className="text-[11.5px] font-bold uppercase tracking-wide text-neutral-mid">{titulo}</p>
      <p className="mt-1.5 text-[33px] font-extrabold leading-none tracking-tight text-neutral-dark tabular-nums">
        {montoTotal == null ? (
          <span title={MONTO_EN_REVISION_MOTIVO}>{MONTO_EN_REVISION}</span>
        ) : (
          <AmountCountUp value={montoTotal} />
        )}
      </p>
      <div
        className={cn(
          "mt-3 flex items-start gap-2 text-[13px] font-semibold",
          coberturaTono === "ok"
            ? "text-success-700"
            : coberturaTono === "neutral"
              ? "text-neutral-mid"
              : "text-danger-500",
        )}
      >
        <Icon className="mt-px size-[18px] shrink-0" aria-hidden="true" />
        <span>{cobertura}</span>
      </div>
      {subtitulo != null && (
        <p className="mt-2.5 text-[12.5px] text-neutral-mid">
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
