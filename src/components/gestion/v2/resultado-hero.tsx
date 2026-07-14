import * as React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { AmountCountUp } from "@/components/qavante/amount-count-up";
import { InfoHint } from "@/components/ui/info-hint";

/* ResultadoHero — la "respuesta de dueño" de Gestión v2: ¿le fue bien o mal al negocio este
   mes? El resultado operacional como número de oro (verde si ganó, rojo si perdió) + la
   respuesta que importa (cuánto mejor/peor que el mes pasado). Presentacional; la respuesta
   llega ya armada. Baranda: es el mensaje central. */

export type ResultadoTono = "ok" | "warn" | "bad";

export interface ResultadoHeroProps {
  /** Antetítulo, ej. "El negocio ganó este mes" / "El negocio perdió este mes". */
  titulo: string;
  /** Resultado operacional del mes (firmado: negativo = pérdida). */
  resultado: number;
  /** Línea de respuesta ("Ganó 12,5% más que el mes pasado"). */
  respuesta: React.ReactNode;
  /** Tono de la respuesta. Default "ok". */
  respuestaTono?: ResultadoTono;
  subtitulo?: React.ReactNode;
  infoHint?: React.ReactNode;
  className?: string;
}

const TONO: Record<ResultadoTono, { text: string; Icon: React.ComponentType<{ className?: string }> }> = {
  ok: { text: "text-success-700", Icon: TrendingUp },
  warn: { text: "text-warning-700", Icon: Minus },
  bad: { text: "text-danger-500", Icon: TrendingDown },
};

export function ResultadoHero({
  titulo,
  resultado,
  respuesta,
  respuestaTono = "ok",
  subtitulo,
  infoHint,
  className,
}: ResultadoHeroProps) {
  const { text, Icon } = TONO[respuestaTono];
  return (
    <div className={cn("p-5", className)}>
      <p className="text-[11.5px] font-bold uppercase tracking-wide text-neutral-mid">{titulo}</p>
      <p
        className={cn(
          "mt-1.5 text-[33px] font-extrabold leading-none tracking-tight tabular-nums",
          // Pérdida → el número mismo va en rojo; ganancia → verde.
          resultado < 0 ? "text-danger-500" : "text-success-700",
        )}
      >
        <AmountCountUp value={resultado} />
      </p>
      <div className={cn("mt-3 flex items-start gap-2 text-[13px] font-semibold", text)}>
        <Icon className="mt-px size-[18px] shrink-0" aria-hidden="true" />
        <span>{respuesta}</span>
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
