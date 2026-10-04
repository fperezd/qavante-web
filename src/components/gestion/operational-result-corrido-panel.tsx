"use client";

import { useOperationalResult, type OperationalResultResponse } from "@/lib/api/gestion";
import { RESULTADO_CORRIDO } from "@/lib/gestion-titulos";
import { formatPeriodLabel, shiftPeriod } from "./gestion-format";
import {
  money,
  moneySuma,
  ResultadoBloque,
  ResultadoBloqueAbstenido,
  ResultadoDesgloseCostoDirecto,
  ResultadoFuentes,
  ResultadoMetric,
  ResultadoMetricRow,
  ResultadoMetricRowCompact,
} from "./resultado-bloque";

/* Bloque de LO CORRIDO de /gestion — `GET /api/management/operational-result?period=YYYY-MM`.
 *
 * Por qué existe: /gestion tenía el diseño de tarjetas SOLO para el bloque del horizonte, y lo
 * corrido —lo que el dueño realmente pregunta cuando lee "Resultado operacional"— únicamente
 * aparecía como la matriz mensual estilo Chipax. Ahora lo corrido usa el MISMO diseño (reusado
 * desde `./resultado-bloque`, no copiado) y conserva el nombre "Resultado operacional".
 *
 * Abre en el último mes CERRADO, no en el mes en curso: en el mes en curso los costos ya están
 * devengados pero las ventas recién empiezan → daría un "perdió $X" falso. Es el mismo criterio
 * que ya aplica `operational-result-view.tsx`.
 *
 * Diferencia de contrato con el bloque del horizonte, y por eso NO se comparte el mapeo:
 * acá `direct_cost` NO incluye remuneraciones ni honorarios (la identidad del contrato es
 * `ebitda_proxy = gross_margin - labor_cost - professional_fees - …`), mientras que en el V2
 * `direct_cost.total` ya viene compuesto. El Costo Directo compuesto se arma sumando las tres
 * partes —el mismo criterio que ya usa `v2/gestion-seccion-view.tsx`— y las tres quedan a la
 * vista debajo para que la suma sea verificable en pantalla. */

const TITULO_ID = "resultado-corrido-title";

/** "2026-09" → "sep 2026 · base devengada · CLP". Mismo formato que el bloque del horizonte. */
export function rangoCorrido(period: string): string {
  return `${formatPeriodLabel(period)} · base devengada · CLP`;
}

/** Último mes CERRADO a partir del mes en curso que calcula la page (America/Santiago). */
export function ultimoMesCerrado(periodoEnCurso: string): string {
  return shiftPeriod(periodoEnCurso, -1);
}

function estadoFuente(source: { applicable: boolean; present: boolean; stale: boolean }): string {
  if (!source.applicable) return "no corresponde";
  if (!source.present) return "faltante";
  if (source.stale) return "atrasada";
  return "vigente";
}

export function OperationalResultCorridoPanel({ initialPeriod }: { initialPeriod: string }) {
  const period = ultimoMesCerrado(initialPeriod);
  const query = useOperationalResult(period);

  if (query.isLoading) {
    return (
      <section className="rounded-xl border border-border bg-surface p-4" role="status">
        <p className="text-sm text-neutral-mid">
          Preparando {RESULTADO_CORRIDO.toLowerCase()} de {formatPeriodLabel(period)}…
        </p>
      </section>
    );
  }

  if (query.isError || !query.data) {
    return (
      <ResultadoBloqueAbstenido
        titulo={RESULTADO_CORRIDO}
        periodo={rangoCorrido(period)}
        tituloId={TITULO_ID}
      >
        Qavante se abstiene de publicar una cifra de {formatPeriodLabel(period)} mientras no pueda
        leer las fuentes del período. Revisa el estado de las fuentes en Salud del dato y vuelve a
        abrir este bloque cuando estén al día.
      </ResultadoBloqueAbstenido>
    );
  }

  return <OperationalResultCorridoView mes={query.data} />;
}

export function OperationalResultCorridoView({ mes }: { mes: OperationalResultResponse }) {
  const eligible = mes.integrity?.decision_support === "eligible";
  const fuentes = (mes.sources ?? []).map((s) => `${s.label}: ${estadoFuente(s)}`);
  /* `result === null` es ABSTENCIÓN explícita del contrato: la integridad del período no es
     `eligible`, así que no se publica una cifra — ni un 0. Las demás cifras del período SÍ se
     publican: un vacío en el resultado no es falta de datos en los ingresos. */
  const resultadoAbstenido = mes.result === null;

  return (
    <ResultadoBloque
      titulo={RESULTADO_CORRIDO}
      eyebrow="Lo que ya ocurrió"
      periodo={rangoCorrido(mes.period)}
      apto={eligible}
      tituloId={TITULO_ID}
    >
      <ResultadoMetricRow>
        <ResultadoMetric label="Ingresos" value={money(mes.revenue)} />
        <ResultadoMetric
          label="Costo Directo"
          value={moneySuma([mes.direct_cost, mes.labor_cost, mes.professional_fees])}
        />
        <ResultadoMetric label="Gastos operacionales" value={money(mes.recurring_expenses)} />
        <ResultadoMetric
          label="Resultado antes de gastos financieros"
          value={money(mes.ebitda_proxy)}
        />
      </ResultadoMetricRow>

      <ResultadoDesgloseCostoDirecto
        base={money(mes.direct_cost)}
        remuneraciones={money(mes.labor_cost)}
        honorarios={money(mes.professional_fees)}
        nota="La base contiene compras asociadas a la entrega y trabajo directo. Remuneraciones y honorarios se muestran aparte y se suman una sola vez."
      />

      <ResultadoMetricRowCompact>
        <ResultadoMetric
          label="Compras sin clasificar"
          value={money(mes.unclassified_purchases)}
          compact
        />
        <ResultadoMetric
          label="Otras partidas sin clasificar"
          value={money(mes.unclassified)}
          compact
        />
        <ResultadoMetric label="Gastos financieros" value={money(mes.financial_expense)} compact />
        <ResultadoMetric label="Resultado final" value={money(mes.result ?? "")} compact />
      </ResultadoMetricRowCompact>

      <ResultadoFuentes items={fuentes} />
      {resultadoAbstenido && (
        <p className="text-sm text-warning-700" role="status">
          Qavante no publica el resultado final de {formatPeriodLabel(mes.period)} porque las
          fuentes requeridas no acreditan el período completo; las cifras de arriba sí vienen del
          período. Revisa el estado de las fuentes en Salud del dato.
        </p>
      )}
    </ResultadoBloque>
  );
}
