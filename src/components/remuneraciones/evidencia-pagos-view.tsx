"use client";

import * as React from "react";
import { ShieldCheck, Info } from "lucide-react";
import { QavanteBadge, QavanteCard } from "@/components/qavante";
import { formatMoneyFromDecimalString } from "@/lib/formatters/clp";
import { formatRut } from "@/lib/formatters/rut";
import { formatDateLike } from "@/lib/formatters/date";
import { cn } from "@/lib/utils";
import type { PayrollWorkerOutstanding } from "@/lib/api/payroll-evidence";
import {
  abstentionCopy,
  evidenceWorkerRows,
  evidenceWorkerTally,
  type EvidenceWorkerStateCopy,
} from "./payroll-evidence-model";

/* Evidencia de pagos de nómina del período (api#422 / #203). Presentacional PURO: recibe la
   respuesta del read model y la muestra. No suma, no resta, no convierte a `number`.

   Lo que esta vista separa a propósito, porque mezclarlo es el defecto que #203 nombra:

   1. **Obligación sellada** — lo que el origen de remuneraciones afirmó que se debía.
   2. **Pago asignado al período** — un lote confirmado que baja el total.
   3. **Repartido persona por persona** — lo único que permite nombrar a alguien.
   4. **Brecha de reparto** — pago que bajó el total y todavía no alcanza para nombrar a nadie.
   5. **Saldo según la evidencia** — obligación menos lo repartido.
   6. **Las cifras legadas, al lado y etiquetadas** — para contrastar, nunca para confirmar.

   Un lote asignado y no repartido **no pone a nadie en verde**. El estado de cada persona lo
   dice el backend; esta vista no lo deriva de comparar montos. */

const TONE_CLASS: Record<EvidenceWorkerStateCopy["tone"], string> = {
  confirmed: "bg-emerald-50 text-emerald-800 border-emerald-200",
  partial: "bg-amber-50 text-amber-900 border-amber-200",
  neutral: "bg-neutral-100 text-neutral-700 border-neutral-200",
};

export function Cifra({
  titulo,
  valor,
  currency,
  cubre,
  sinCifra,
  destacada = false,
}: {
  titulo: string;
  valor: string | null | undefined;
  currency: string | null | undefined;
  /** Qué cubre la cifra. Obligatorio: una cifra sin qué cubre no se muestra. */
  cubre: string;
  /** La frase que ocupa el lugar de la cifra cuando el contrato la publica en `null`. */
  sinCifra: string;
  destacada?: boolean;
}) {
  /* Un `null` del contrato NO se pinta como "$0" ni como un guion: lo primero afirmaría un cero
     que la evidencia no sostiene, y lo segundo deja al lector adivinando. En su lugar va la
     frase que dice qué falta para que el período tenga esa cifra. */
  const texto = formatMoneyFromDecimalString(valor, currency);
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        destacada ? "border-neutral-300 bg-neutral-50" : "border-neutral-200",
      )}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-mid">{titulo}</div>
      {texto === null ? (
        <p className="mt-1 text-sm leading-snug text-neutral-dark">{sinCifra}</p>
      ) : (
        <div
          className={cn(
            "mt-1 tabular-nums",
            destacada ? "text-xl font-semibold text-neutral-dark" : "text-lg text-neutral-dark",
          )}
        >
          {texto}
        </div>
      )}
      <p className="mt-1 text-xs leading-snug text-neutral-mid">{cubre}</p>
    </div>
  );
}

/* Los tres montos por trabajador son obligatorios en el contrato: siempre llega un número. Si
   `formatMoneyFromDecimalString` no pudiera leerlo, se muestra el string exacto que publicó la
   lectura en vez de un placeholder: mostrar la cifra tal cual es más honesto que esconderla. */
function montoDeFila(valor: string, currency: string | null): string {
  return formatMoneyFromDecimalString(valor, currency) ?? valor;
}

export interface EvidenciaPagosViewProps {
  periodLabel: string;
  data: PayrollWorkerOutstanding;
}

export function EvidenciaPagosView({ periodLabel, data }: EvidenciaPagosViewProps) {
  const rows = React.useMemo(() => evidenceWorkerRows(data), [data]);
  const tally = React.useMemo(() => evidenceWorkerTally(data), [data]);
  const currency = data.currency_code ?? null;
  const abstentions = data.abstention_reasons ?? [];

  return (
    <QavanteCard className="space-y-4 p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-neutral-dark">
            <ShieldCheck className="h-4 w-4 text-neutral-mid" aria-hidden />
            Pagos con evidencia · {periodLabel}
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-neutral-mid">
            {tally.confirmed} de {tally.total} personas de la obligación sellada tienen un pago
            confirmado repartido a su nombre. {tally.partial} con pago parcial y {tally.unallocated}{" "}
            sin pago repartido todavía.
          </p>
        </div>
        {data.obligation_observed_at ? (
          <QavanteBadge className="shrink-0">
            Obligación sellada el {formatDateLike(data.obligation_observed_at)}
          </QavanteBadge>
        ) : null}
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Cifra
          titulo="Obligación sellada"
          sinCifra="El período todavía no tiene una obligación sellada."
          valor={data.obligation_amount}
          currency={currency}
          cubre={`Lo que el origen de remuneraciones afirmó que se debía en el período, sumando sus ${tally.total} líneas.`}
          destacada
        />
        <Cifra
          titulo="Saldo según la evidencia"
          sinCifra="Sin obligación sellada no hay saldo que restar."
          valor={data.confirmed_outstanding_amount}
          currency={currency}
          cubre="La obligación sellada menos lo que está repartido persona por persona."
          destacada
        />
        <Cifra
          titulo="Pago asignado al período"
          sinCifra="El período no registra pago asignado."
          valor={data.batch_allocated_amount}
          currency={currency}
          cubre="Lotes confirmados aplicados al período, con o sin reparto por persona."
        />
        <Cifra
          titulo="Repartido persona por persona"
          sinCifra="El período no registra pago repartido por persona."
          valor={data.worker_allocated_amount}
          currency={currency}
          cubre="De ese pago, la parte que tiene nombre y apellido. Es la única que pone a alguien en verde."
        />
        <Cifra
          titulo="Brecha de reparto"
          sinCifra="Sin pago asignado no hay brecha de reparto."
          valor={data.distribution_gap_amount}
          currency={currency}
          cubre="Pago que bajó el total del período y todavía no alcanza para nombrar a nadie."
        />
        <Cifra
          titulo="Pago sobre un sello anterior"
          sinCifra="El período no registra pago sobre un sello anterior."
          valor={data.superseded_obligation_allocated_amount}
          currency={currency}
          cubre="Pago asignado a un sello previo de esta obligación, contra montos que el origen ya cambió. No se suma arriba."
        />
      </div>

      {/* Las cifras legadas, separadas y etiquetadas: están para contrastar, no para confirmar. */}
      <section className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-3">
        <h4 className="text-sm font-semibold text-neutral-dark">
          Las cifras de la capa anterior, para contrastar
        </h4>
        <p className="mt-1 text-xs leading-snug text-neutral-mid">
          Estas tres vienen del modelo anterior de nómina. Las respalda el registro de la
          liquidación, no un pago trazable, así que no confirman a nadie: están acá para ver dónde
          las dos capas cuentan distinto.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Cifra
            titulo="Saldo del payable mensual"
            sinCifra="El período no tiene exactamente un payable del que leer el saldo."
            valor={data.legacy_payable_outstanding_amount}
            currency={currency}
            cubre="Lo que el payable del mes declara pendiente."
          />
          <Cifra
            titulo="Saldo sumado por persona"
            sinCifra="La capa anterior no registra liquidaciones del período."
            valor={data.legacy_worker_outstanding_amount}
            currency={currency}
            cubre="Lo que la capa anterior suma liquidación por liquidación."
          />
          <Cifra
            titulo="Dado por pagado sin enlace"
            sinCifra="La capa anterior no registra pagos sin enlace en el período."
            valor={data.legacy_assumed_paid_amount}
            currency={currency}
            cubre="De la capa anterior, lo que figura pagado sin un movimiento ni una declaración que lo respalde."
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

      {rows.length > 0 ? (
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-mid">
                <th className="py-2 pr-3 font-medium">Persona</th>
                <th className="py-2 pr-3 text-right font-medium">Obligación sellada</th>
                <th className="py-2 pr-3 text-right font-medium">Pago con evidencia</th>
                <th className="py-2 pr-3 text-right font-medium">Saldo</th>
                <th className="py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-neutral-100 align-top last:border-0">
                  <td className="py-2 pr-3">
                    <div className="font-medium text-neutral-dark">
                      {row.workerName ?? "Línea sellada sin nombre en el origen"}
                    </div>
                    <div className="text-xs text-neutral-mid">
                      {row.workerRut
                        ? formatRut(row.workerRut)
                        : "El origen selló esta línea sin RUT, así que su monto no se le atribuye a una persona."}
                    </div>
                    {row.legacyQuality ? (
                      <div className="mt-1 text-xs text-neutral-mid">{row.legacyQuality}</div>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-neutral-dark">
                    {montoDeFila(row.obligationAmount, row.currencyCode)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-neutral-dark">
                    {montoDeFila(row.confirmedPaidAmount, row.currencyCode)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-neutral-dark">
                    {montoDeFila(row.outstandingAmount, row.currencyCode)}
                  </td>
                  <td className="py-2">
                    <span
                      className={cn(
                        "inline-block rounded-md border px-2 py-0.5 text-xs font-medium",
                        TONE_CLASS[row.state.tone],
                      )}
                    >
                      {row.state.label}
                    </span>
                    <p className="mt-1 max-w-xs text-xs leading-snug text-neutral-mid">
                      {row.state.detail}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-neutral-mid">
          La obligación del período tiene 0 líneas selladas, así que esta lectura no nombra a
          ninguna persona. Las abstenciones de arriba dicen qué falta para que las tenga.
        </p>
      )}
    </QavanteCard>
  );
}
