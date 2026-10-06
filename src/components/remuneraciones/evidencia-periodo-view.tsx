"use client";

import * as React from "react";
import { Info, Landmark } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { cn } from "@/lib/utils";
import { formatDateLike } from "@/lib/formatters/date";
import type { PayrollPeriodEvidence } from "@/lib/api/payroll-evidence";
import { Cifra } from "./evidencia-pagos-view";
import {
  abstentionCopy,
  allocationCoverageCopy,
  periodStateCopy,
  type EvidencePeriodStateCopy,
} from "./payroll-evidence-model";

/* El período, con las cinco separaciones de #203 (api#422). Presentacional PURO: recibe la
   respuesta de `GET /api/treasury/payroll-evidence/{YYYY-MM}` y la muestra. No suma, no resta y
   no convierte ningún monto a `number`.

   El defecto que cierra: hasta acá la pantalla sólo contaba lo CONFIRMADO, así que un pago
   **observado y por verificar** no aparecía en ninguna cifra y el período se leía igual que uno
   donde nadie pagó. Ahora lo observado tiene su propio recuadro, con su propio rótulo, y el
   estado del período dice en palabras que todavía no está confirmado.

   Las dos cifras van juntas y SEPARADAS a propósito:

   - **Pago observado, por verificar** — alguien movió plata contra el período y nadie lo
     confirmó. No baja el saldo y no cuenta como pagado.
   - **Saldo con evidencia confirmada** — lo que falta según la evidencia. En `null` es una
     abstención, no un cero: pintarlo "$0" afirmaría que no se debe nada.

   Y la cobertura de la asignación va aparte del estado, porque son preguntas distintas: un pago
   confirmado puede bajar el total del período y seguir sin repartirse a una sola persona. */

const TONE_CLASS: Record<EvidencePeriodStateCopy["tone"], string> = {
  confirmed: "border-emerald-200 bg-emerald-50 text-emerald-900",
  partial: "border-amber-200 bg-amber-50 text-amber-900",
  observed: "border-sky-200 bg-sky-50 text-sky-900",
  conflict: "border-rose-200 bg-rose-50 text-rose-900",
  neutral: "border-neutral-200 bg-neutral-100 text-neutral-700",
};

export interface EvidenciaPeriodoViewProps {
  periodLabel: string;
  data: PayrollPeriodEvidence;
}

export function EvidenciaPeriodoView({ periodLabel, data }: EvidenciaPeriodoViewProps) {
  /* El estado lo DICE el backend. Esta vista no lo deduce de comparar `observed_payment_amount`
     con `obligation_amount`: deducir "está pagado" porque dos cifras calzan es exactamente lo
     que #203 prohíbe, y una diferencia exacta es la trampa más fácil de caer. */
  const estado = periodStateCopy(data.state);
  const cobertura = allocationCoverageCopy(data.allocation_coverage);
  const currency = data.currency_code ?? null;
  const abstentions = data.abstention_reasons ?? [];

  return (
    <QavanteCard className="space-y-4 p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-neutral-dark">
            <Landmark className="h-4 w-4 text-neutral-mid" aria-hidden />
            La evidencia del período · {periodLabel}
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-neutral-mid">
            Lo que el origen selló, lo que se observó moverse y lo que quedó confirmado, cada uno
            por su lado. Un pago observado no cuenta como pagado hasta que alguien lo confirma.
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-md border px-2 py-1 text-xs font-medium",
            TONE_CLASS[estado.tone],
          )}
        >
          {estado.label}
        </span>
      </header>

      <p className="text-sm leading-snug text-neutral-dark">{estado.detail}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra
          titulo="Obligación sellada"
          sinCifra="El período todavía no tiene una obligación sellada contra la que contar pagos."
          valor={data.obligation_amount}
          currency={currency}
          cubre={
            data.obligation_observed_at
              ? `Lo que el origen de remuneraciones afirmó que se debía, sellado el ${formatDateLike(
                  data.obligation_observed_at,
                )}.`
              : "Lo que el origen de remuneraciones afirmó que se debía en el período."
          }
          destacada
        />
        <Cifra
          titulo="Pago observado, por verificar"
          sinCifra="El período no registra ningún pago observado contra la obligación."
          valor={data.observed_payment_amount}
          currency={currency}
          cubre="Plata que se observó moverse contra el período y que todavía nadie confirmó. No baja el saldo ni rotula a nadie como pagado."
        />
        <Cifra
          titulo="Saldo con evidencia confirmada"
          sinCifra="La lectura se abstiene del saldo: las razones de abajo dicen qué le falta al período para tenerlo."
          valor={data.confirmed_outstanding_amount}
          currency={currency}
          cubre="Lo que falta cubrir contando sólo pagos confirmados, tal como lo publica la lectura del período."
          destacada
        />
        <div className="rounded-lg border border-neutral-200 p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-mid">
            Cobertura de la asignación
          </div>
          <div className="mt-1 text-sm font-semibold text-neutral-dark">{cobertura.label}</div>
          <p className="mt-1 text-xs leading-snug text-neutral-mid">{cobertura.detail}</p>
        </div>
      </div>

      {/* La cifra de la capa anterior va aparte y etiquetada: está para contrastar, nunca para
          confirmar. El contrato la publica con su propia etiqueta de calidad y la pantalla la
          repite en vez de traducirla a un número más de los de arriba. */}
      <section className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-3">
        <h4 className="text-sm font-semibold text-neutral-dark">
          El saldo de la capa anterior, para contrastar
        </h4>
        <div className="mt-3">
          <Cifra
            titulo="Saldo del modelo anterior"
            sinCifra="La capa anterior no publica un saldo para el período."
            valor={data.legacy_outstanding_amount}
            currency={currency}
            cubre="Lo que el modelo anterior de nómina declara pendiente. Lo respalda el registro de la liquidación, no un pago trazable, así que no confirma a nadie."
          />
        </div>
      </section>

      {abstentions.length > 0 ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <Info className="h-4 w-4" aria-hidden />
            Por qué el período no afirma más que esto
          </h4>
          <ul className="mt-2 space-y-1.5">
            {abstentions.map((code) => (
              <li key={code} className="text-xs leading-snug text-amber-900">
                {abstentionCopy(code)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </QavanteCard>
  );
}
