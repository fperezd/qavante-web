import * as React from "react";
import { cn } from "@/lib/utils";
import { formatClp } from "@/lib/formatters/clp";
import { Sparkline } from "@/components/ui/sparkline";

/* CajaProyeccion (Inicio Ejecutivo v2). Fusiona "caja hoy + proyectada + brecha" en
   una sola card (antes eran 3 puertas a la misma pantalla): saldo de hoy, curva
   proyectada con la línea de cero, y las mínimas a 14/30 días + días de caja.
   Presentacional puro. */

export interface CajaFila {
  label: string;
  /** Ya formateado por el data layer (permite "~0" y "96 días" además de plata). */
  valor: string;
  tono?: "neg" | "pos" | "neutral";
}

export interface CajaProyeccionProps {
  /** Saldo de hoy. `null` = NO lo sabemos (el bloque `cash_today` no vino): se muestra
   *  "Sin dato" en neutro, nunca un "$0" (faltante ≠ 0, §13). */
  cajaHoy: number | null;
  /** "Caja hoy" / "Caja hoy · estimada" / "Caja hoy · desactualizada" según data_state. */
  subtitulo: string;
  /** Serie de la caja proyectada (curva). */
  serie: number[];
  filas: CajaFila[];
  /** "Actualizado 08-07 20:00 · banco". */
  stamp: string;
  className?: string;
}

const FILA_TEXT: Record<NonNullable<CajaFila["tono"]>, string> = {
  neg: "text-danger-500",
  pos: "text-success-700",
  neutral: "text-neutral-dark",
};

export function CajaProyeccion({
  cajaHoy,
  subtitulo,
  serie,
  filas,
  stamp,
  className,
}: CajaProyeccionProps) {
  // Saldo desconocido (banco caído / bloque ausente) ≠ saldo cero. Nunca pintamos $0 en verde.
  const desconocida = cajaHoy == null;
  const negativa = !desconocida && cajaHoy < 0;
  return (
    <section
      className={cn("rounded-xl border border-border bg-surface p-5 shadow-sm", className)}
      aria-label="Caja"
    >
      <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-mid">Caja</p>
      <p
        className={cn(
          "mt-1 text-2xl font-extrabold tabular-nums tracking-tight",
          desconocida ? "text-neutral-mid" : negativa ? "text-danger-500" : "text-success-700",
        )}
      >
        {desconocida ? "Sin dato" : formatClp(cajaHoy)}
      </p>
      <p className="mt-0.5 text-xs text-neutral-mid">{subtitulo}</p>

      <Sparkline
        data={serie}
        tone={desconocida ? "neutral" : negativa ? "danger" : "success"}
        baseline={0}
        width={320}
        height={52}
        className="my-2 w-full"
      />

      {filas.map((f, i) => (
        <div key={i} className="flex items-baseline justify-between py-1 text-[13.5px]">
          <span className="text-neutral-mid">{f.label}</span>
          <span className={cn("font-bold tabular-nums", FILA_TEXT[f.tono ?? "neutral"])}>
            {f.valor}
          </span>
        </div>
      ))}

      <p className="mt-3 text-[11px] text-neutral-mid">🕒 {stamp}</p>
    </section>
  );
}
