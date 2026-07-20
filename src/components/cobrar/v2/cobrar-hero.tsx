import * as React from "react";
import { cn } from "@/lib/utils";
import { AmountCountUp } from "@/components/qavante/amount-count-up";
import { InfoHint } from "@/components/ui/info-hint";
import { formatRut } from "@/lib/formatters/rut";

/* CobrarHero — la "respuesta de dueño" de Cobrar v2: A QUIÉN le cobras primero y
   cuánto, con la cifra que importa (lo vencido si se sabe; el total si aún no hay
   vencimientos). El antetítulo y la bajada los decide el modo (urgencia vs.
   concentración) en el contenedor — este componente solo pinta. Las acciones
   (copiar recordatorio, WhatsApp, mail, gestionado) van como slot. Presentacional. */

export interface CobrarHeroProps {
  /** "Cóbrale primero a" (urgencia) o "Tu mayor cobranza" (concentración). */
  antetitulo: string;
  /** Nombre del cliente. */
  cliente: string;
  rut?: string;
  /** Cifra destacada (CLP): lo vencido en urgencia, el total en concentración. */
  monto: number;
  /** Etiqueta bajo la cifra, ej. "vencido" o "por cobrar". */
  montoLabel: string;
  /** Rojo si es mora; neutro si es un total sin urgencia conocida. */
  montoTono?: "danger" | "neutral";
  /** Bajada honesta (ej. "55% del total · aún no sabemos qué está vencido"). */
  bajada: React.ReactNode;
  infoHint?: React.ReactNode;
  /** Slot de acciones (`<CobranzaAcciones/>`). */
  acciones?: React.ReactNode;
  className?: string;
}

export function CobrarHero({
  antetitulo,
  cliente,
  rut,
  monto,
  montoLabel,
  montoTono = "neutral",
  bajada,
  infoHint,
  acciones,
  className,
}: CobrarHeroProps) {
  return (
    <div className={cn("p-5", className)}>
      <p className="text-[11.5px] font-bold uppercase tracking-wide text-neutral-mid">
        {antetitulo}
      </p>
      <p className="mt-1 text-[22px] font-extrabold leading-tight tracking-tight text-neutral-dark">
        {cliente}
        {rut ? <span className="ml-2 text-[13px] font-medium text-neutral-mid">{formatRut(rut)}</span> : null}
      </p>

      <p className="mt-2 flex items-baseline gap-2">
        <span
          className={cn(
            "text-[30px] font-extrabold leading-none tracking-tight tabular-nums",
            montoTono === "danger" ? "text-danger-500" : "text-neutral-dark",
          )}
        >
          <AmountCountUp value={monto} />
        </span>
        <span className="text-[12.5px] font-semibold text-neutral-mid">{montoLabel}</span>
      </p>

      <p className="mt-2.5 text-[12.5px] leading-relaxed text-neutral-mid">
        {bajada}
        {infoHint ? (
          <>
            {" "}
            <InfoHint label="Cómo elegimos a quién cobrar">{infoHint}</InfoHint>
          </>
        ) : null}
      </p>

      {acciones ? <div className="mt-4">{acciones}</div> : null}
    </div>
  );
}
