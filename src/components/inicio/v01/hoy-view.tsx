import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, HelpCircle } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { cn } from "@/lib/utils";
import { formatClp } from "@/lib/formatters/clp";
import { parseAmountOrNull } from "@/lib/formatters/amount";
import type { DashboardSummaryV2 } from "@/lib/api/dashboard";
import type { LiquidityEvaluation } from "@/lib/api/financial-decisions";
import { cajaHoy } from "@/lib/finanzas/caja-hoy";
import {
  crumbHoy,
  decisionesHoy,
  indicadoresHoy,
  veredictoHoy,
  type EstadoHoy,
  type IndicadorHoy,
} from "./hoy-model";
import { LiquidityEvaluationPanel } from "./liquidity-evaluation-panel";
import { liquidityEvaluationView } from "./liquidity-evaluation-model";

/* V01 · Hoy — "¿cómo está mi empresa y qué necesita mi OK?" (rediseño Fase 2, issue #62).
 *
 * PRESENTACIONAL: entra un summary, sale una pantalla. Sin hooks ni red — el cableado vive en
 * `hoy-live.tsx`. Así la vista entera se puede renderear en un test y en una story sin MSW, que
 * es lo que permite fijar los cuatro estados del titular con aserciones de verdad.
 *
 * LO QUE FALTA, DICHO ACÁ Y NO SÓLO EN EL PR: la sección 5 de la spec, "Mientras no estabas"
 * (bitácora), NO se implementa. La spec la marca `🏗` — no existe la API — y la aceptación de
 * V01 pide que con el flag apagado la vista ande con los datos de hoy. Las dos no pueden ser
 * ciertas a la vez. Rellenarla con eventos de sincronización y conciliaciones bajo un título que
 * promete "esto pasó mientras no estabas" sería un default plausible con nombre de otra cosa.
 * Queda como hueco declarado, con su issue sucesor: #65.
 *
 * LEY 2 — máximo UN rojo por pantalla: el único `danger-*` de este archivo es el bloque del
 * veredicto en crisis. Atención va en ámbar, el "no sé" en neutro y los indicadores nunca se
 * pintan de rojo. Se CUENTA sobre el DOM renderizado, no se promete: las stories de
 * `hoy-view.stories.tsx` (`rojos()`) afirman cero elementos `danger-*` en sana, atención, día
 * perfecto y sin dato, y en crisis que todos los que hay viven dentro del veredicto. Corren en
 * Chromium como gate (`npm run test:storybook`). No es un `.test.tsx` porque en `main` el
 * proyecto `unit` de vitest no compila JSX (`jsx: "preserve"`, muere en el parseo al importar
 * cualquier componente); el arreglo de una línea es el PR #63, abierto. */

export interface HoyViewProps {
  /** El summary del dashboard. `null` = no llegó (se muestra el veredicto "sin dato"). */
  data: DashboardSummaryV2 | null;
  /** Razón social del tenant activo (`/api/me`). */
  empresa?: string | null;
  /** Referencia de "hoy". Explícita para tests y stories deterministas. */
  hoy?: Date;
  /** Snapshot F1 persistido. La vista no calcula ni completa sus campos financieros. */
  liquidityEvaluation?: LiquidityEvaluation | null;
  liquidityLoading?: boolean;
  liquidityFailed?: boolean;
}

/* Tono del titular. `sin_dato` es NEUTRO y no rojo: "no sabemos" no es "está mal". */
const TONO_TITULAR: Record<EstadoHoy, string> = {
  crisis: "text-danger-700",
  atencion: "text-warning-700",
  sana: "text-success-700",
  sin_dato: "text-neutral-mid",
};

const TONO_MARCO: Record<EstadoHoy, string> = {
  crisis: "border-danger-500/40 bg-danger-50",
  atencion: "border-warning-500/40 bg-warning-50",
  sana: "border-success-500/40 bg-success-50",
  sin_dato: "border-border bg-neutral-light/20",
};

function IconoVeredicto({ estado }: { estado: EstadoHoy }) {
  const Icono =
    estado === "crisis" || estado === "atencion"
      ? AlertTriangle
      : estado === "sana"
        ? CheckCircle2
        : HelpCircle;
  return <Icono className={cn("h-6 w-6 shrink-0", TONO_TITULAR[estado])} aria-hidden="true" />;
}

export function HoyView({
  data,
  empresa,
  hoy = new Date(),
  liquidityEvaluation = null,
  liquidityLoading = false,
  liquidityFailed = false,
}: HoyViewProps) {
  const caja = cajaHoy(data);
  const crumb = crumbHoy(empresa, caja, hoy);
  const liquidityView = liquidityEvaluation
    ? liquidityEvaluationView(liquidityEvaluation, hoy)
    : null;
  const liquidityPending =
    liquidityView?.decisionSupport === "eligible" && liquidityView.valid ? 1 : 0;
  const v = veredictoHoy(data, hoy, liquidityPending);
  const decisiones = decisionesHoy(data, v.soloDecisionCritica, liquidityPending);
  const indicadores = indicadoresHoy(data);

  /* Ley 10. En crisis se muestra SÓLO la decisión crítica: nada de strip de indicadores ni de
     contexto de apoyo. En el día perfecto la pantalla termina en el titular — no hay nada que
     aprobar, así que no se abre una sección vacía que lo desmienta. */
  const mostrarDecisiones = decisiones.length > 0;
  const mostrarIndicadores = !v.soloDecisionCritica;

  return (
    <div className="space-y-6">
      {/* (1) Crumb: fecha + empresa + frescura del banco. */}
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
        <span>{crumb.fecha}</span>
        <span aria-hidden="true">·</span>
        <span>{crumb.empresa}</span>
        <span aria-hidden="true">·</span>
        <span
          className={cn(
            "inline-flex items-center gap-1 normal-case tracking-normal",
            crumb.bancoConReparo ? "text-warning-700" : "text-neutral-mid",
          )}
        >
          <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
          {crumb.banco}
        </span>
      </p>

      {/* (2) Titular-veredicto + "hay N cosas que necesitan tu OK". (3) Subtítulo de contexto. */}
      <section
        aria-labelledby="hoy-titular"
        className={cn("rounded-xl border p-5", TONO_MARCO[v.estado])}
      >
        <div className="flex items-start gap-3">
          <IconoVeredicto estado={v.estado} />
          <div className="min-w-0">
            <h2
              id="hoy-titular"
              className={cn("text-2xl font-semibold leading-tight", TONO_TITULAR[v.estado])}
            >
              {v.titular}
            </h2>
            {/* En el día perfecto el titular YA dice "No hay nada que necesite tu OK": repetirlo
                debajo es ruido. */}
            {!v.diaPerfecto && (
              <p className="mt-1 text-sm font-medium text-neutral-dark">{v.pendientesLabel}</p>
            )}
            {v.contexto.length > 0 && (
              <div className="mt-2 space-y-0.5">
                {v.contexto.map((linea) => (
                  <p key={linea} className="text-sm text-neutral-mid">
                    {linea}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Evaluación F1 persistida: forma parte de Hoy y no abre un dashboard paralelo. La API es
          read-only, por eso esta sección explica y compara pero no ofrece CTAs de ejecución. */}
      {(!v.soloDecisionCritica || liquidityPending > 0) && (
        <LiquidityEvaluationPanel
          evaluation={liquidityEvaluation}
          loading={liquidityLoading}
          failed={liquidityFailed}
          now={hoy}
        />
      )}

      {/* (4) "Esperando tu visto bueno". Las acciones del dashboard son el fallback de los casos
          que aún no resuelve el Decision OS. Una evaluación F1 vigente consume uno de los tres
          lugares; en crisis reemplaza el fallback para mantener una sola decisión crítica. */}
      {mostrarDecisiones && (
        <section aria-labelledby="hoy-vb" className="space-y-3">
          <h3
            id="hoy-vb"
            className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid"
          >
            Esperando tu visto bueno
          </h3>
          <ul className="space-y-3">
            {decisiones.map((a) => {
              const monto = parseAmountOrNull(a.amount);
              return (
                <li key={a.priority}>
                  <QavanteCard variant="bordered">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-neutral-dark">{a.reason}</p>
                        <p className="mt-1 text-sm text-neutral-mid">
                          {monto != null && (
                            <span className="font-semibold tabular-nums text-neutral-dark">
                              {formatClp(monto)}
                            </span>
                          )}
                          {monto != null && a.impact_label ? " · " : ""}
                          {a.impact_label}
                          {(monto != null || a.impact_label) && a.deadline ? " · " : ""}
                          {a.deadline && <>Plazo: {a.deadline}</>}
                        </p>
                      </div>
                      <Link
                        href={a.cta_href}
                        className="group inline-flex shrink-0 items-center gap-1 rounded-md border border-brand-primary/40 px-3 py-1.5 text-xs font-semibold text-brand-primary transition-colors hover:bg-brand-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
                      >
                        {a.cta_label}
                        <ArrowRight
                          className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </Link>
                    </div>
                  </QavanteCard>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* (5) "Mientras no estabas" — NO EXISTE. Ver la nota del encabezado: la API de bitácora es
          `🏗` y no se rellena con otra cosa bajo ese título. El hueco es visible y tiene issue. */}

      {/* (6) Strip de 4 indicadores. */}
      {mostrarIndicadores && (
        <section aria-labelledby="hoy-indicadores">
          <h3 id="hoy-indicadores" className="sr-only">
            Indicadores de tu empresa
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {indicadores.map((i) => (
              <Indicador key={i.label} indicador={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* Un indicador del strip. El "no sé" se pinta NEUTRO y con su motivo al lado: un guion mudo no
   se distingue de un bug, y un $0 en su lugar sería una afirmación que nadie midió. */
function Indicador({ indicador }: { indicador: IndicadorHoy }) {
  const cuerpo = (
    <QavanteCard
      variant="bordered"
      className={cn(
        "h-full transition-all duration-150",
        indicador.href && "group-hover:shadow-lg",
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
        {indicador.label}
      </p>
      <p
        className={cn(
          "mt-1.5 text-xl font-bold tabular-nums",
          indicador.valor != null ? "text-neutral-dark" : "text-neutral-mid",
        )}
      >
        {indicador.valor ?? "Sin dato"}
      </p>
      <p className="mt-0.5 text-xs text-neutral-mid">{indicador.detalle}</p>
    </QavanteCard>
  );

  return indicador.href ? (
    <Link
      href={indicador.href}
      className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
    >
      {cuerpo}
    </Link>
  ) : (
    cuerpo
  );
}
