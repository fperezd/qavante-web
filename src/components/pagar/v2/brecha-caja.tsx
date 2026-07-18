import * as React from "react";
import { cn } from "@/lib/utils";
import { formatClp } from "@/lib/formatters/clp";
import { calcularBrecha, brechaResidual } from "./brecha-caja-model";

/* BrechaCaja — la brecha de caja de Pagar v2, VISUAL: una barra de cuánto cubre la caja
   proyectada de los pagos críticos, y el insight accionable (cuánto de la brecha es
   postergable → la brecha real). Es el espejo del "plan de cierre" del Inicio.
   Presentacional; la aritmética vive en `brecha-caja-model`. */

export interface BrechaCajaProps {
  /** Caja proyectada al horizonte (ej. projected_cash_14d). */
  cajaProyectada: number;
  /** Pagos críticos del horizonte (vencido + no postergables por vencer). */
  pagosCriticos: number;
  /** Horizonte en días (default 14). */
  dias?: number;
  /** Cuánto de la brecha es postergable/negociable (para el insight). */
  postergable?: number;
  /** `true` mientras la postergabilidad la INFIERE el FE por tipo de pago (no un flag por documento
   *  del backend). Muestra una nota honesta. El contenedor lo apaga cuando CC-API mande el flag
   *  real (A3). Default false: sin marca salvo que el contenedor la pida. */
  postergabilidadEstimada?: boolean;
  className?: string;
}

export function BrechaCaja({
  cajaProyectada,
  pagosCriticos,
  dias = 14,
  postergable = 0,
  postergabilidadEstimada = false,
  className,
}: BrechaCajaProps) {
  const b = calcularBrecha(cajaProyectada, pagosCriticos);
  const residual = brechaResidual(b.faltante, postergable);

  return (
    <section className={cn("p-5", className)} aria-label="Brecha de caja">
      <p className="text-[11.5px] font-bold uppercase tracking-wide text-neutral-mid">
        Caja vs. pagos críticos · {dias} días
      </p>

      <div className="mt-3 h-[26px] overflow-hidden rounded-lg border border-border bg-danger-500/10">
        <div
          className="h-full rounded-l-lg bg-gradient-to-r from-brand-primary to-brand-primary/80"
          style={{ width: `${b.pctCubierto}%` }}
        />
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-neutral-mid">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-[3px] bg-brand-primary" />
          Caja {dias}d <b className="font-bold tabular-nums text-neutral-dark">{formatClp(cajaProyectada)}</b>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-[3px] bg-danger-500" />
          Críticos {dias}d <b className="font-bold tabular-nums text-neutral-dark">{formatClp(pagosCriticos)}</b>
        </span>
      </div>

      {b.cubre ? (
        <p className="mt-3 text-[12.5px] font-semibold text-success-700">
          La caja cubre lo crítico · holgura {formatClp(b.holgura)}.
        </p>
      ) : postergable > 0 ? (
        <p className="mt-3 rounded-lg border border-warning-500/30 bg-warning-500/10 px-2.5 py-1.5 text-[12px] text-neutral-dark">
          De la brecha, <b className="text-warning-700">{formatClp(postergable)} es postergable</b> → si se empujan
          esos pagos, la brecha real baja a <b>{formatClp(residual)}</b>.
        </p>
      ) : (
        <p className="mt-3 text-[12.5px] font-semibold text-danger-500">
          Faltan {formatClp(b.faltante)} para cubrir los pagos críticos.
        </p>
      )}

      {postergabilidadEstimada && pagosCriticos > 0 && (
        <p className="mt-2 text-[11px] leading-snug text-neutral-mid">
          Qué es crítico y qué es postergable lo estima Qavante por tipo de pago; todavía no viene
          marcado por documento.
        </p>
      )}
    </section>
  );
}
