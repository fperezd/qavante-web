"use client";

import * as React from "react";
import { Sparkles, TrendingDown } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { QavanteCard } from "@/components/qavante";
import {
  useBudgetVsActual,
  budgetVsActualQueryOptions,
  useProposeBudget,
  useBudgetGrid,
  useEditBudgetLine,
  useAcceptBudget,
  budgetByAccountQueryOptions,
  type BudgetVsActualResponse,
  type BudgetByAccountResponse,
} from "@/lib/api/planning";
import { buildBudgetGrid } from "./budget-grid-model";
import { BudgetGridView } from "./budget-grid-view";
import { buildPlanRealYear } from "./plan-real-year-model";
import { PlanRealYearView } from "./plan-real-year-view";
import { currentPeriodSantiago, shiftPeriod } from "@/components/gestion/gestion-format";
import { mesCorto } from "@/components/gestion/v2/gestion-v2-map";
import { formatClp } from "@/lib/formatters/clp";
import { cn } from "@/lib/utils";
import { mapPlanReal, agregarPlanReal, type PlanReal } from "@/components/inicio/v2/plan-real-model";
import { heroPresupuesto, desviosPresupuesto, type Semaforo, type DesvioLinea } from "./presupuesto-model";

/* Pantalla PRESUPUESTO (ADR-0091, Fase 1a). "El presupuesto no se llena: se PROPONE desde tu historial;
   tú lo ajustas con un gesto y Qavante te avisa antes de pasarte." Una sola pantalla: cómo vas → qué se
   desvía (por CONCEPTO: ventas/costos/gastos, dato real de budget-vs-actual) → cierre de año (Fase 1b del
   backend, honesto "muy pronto"). El desglose por CUENTA (marketing/sueldos) espera presupuesto a nivel de
   cuenta. Consume budget-vs-actual (mensual/anual) + budget/propose. La lógica pura vive en `presupuesto-model`. */

const SEMAFORO: Record<Semaforo, { pill: string; texto: string }> = {
  good: { pill: "bg-success-700/10 text-success-700", texto: "text-success-700" },
  warn: { pill: "bg-amber-100 text-amber-700", texto: "text-amber-700" },
  bad: { pill: "bg-danger-500/10 text-danger-500", texto: "text-danger-500" },
};

const META_OPCIONES: { label: string; pct: number }[] = [
  { label: "Sin cambios", pct: 0 },
  { label: "+5% ventas", pct: 0.05 },
  { label: "+8% ventas", pct: 0.08 },
  { label: "+10% ventas", pct: 0.1 },
];

export function PresupuestoView() {
  const [modo, setModo] = React.useState<"mes" | "anio">("mes");
  const [metaPct, setMetaPct] = React.useState(0);
  // En modo "Año": ver el presupuesto EDITABLE (plan) o el PLAN VS REAL por cuenta-mes.
  const [vistaAnual, setVistaAnual] = React.useState<"plan" | "real">("plan");

  const periodos = React.useMemo(() => {
    const actual = currentPeriodSantiago(new Date());
    const ultimoCerrado = shiftPeriod(actual, -1);
    const year = actual.slice(0, 4);
    const meses: string[] = [];
    for (let m = 1; m <= 12; m++) {
      const p = `${year}-${String(m).padStart(2, "0")}`;
      if (p <= ultimoCerrado && p.slice(0, 4) === year) meses.push(p);
    }
    return { ultimoCerrado, year, mesesAnio: meses };
  }, []);

  const mesQuery = useBudgetVsActual(periodos.ultimoCerrado, modo === "mes");
  const anioQueries = useQueries({
    queries: periodos.mesesAnio.map((p) => budgetVsActualQueryOptions(p, modo === "anio")),
  });
  const propose = useProposeBudget();

  // Grilla anual EDITABLE (solo en modo "Año"): cuentas × 12 meses, editar celda + aceptar.
  const year = Number(periodos.year);
  const gridQuery = useBudgetGrid(year, modo === "anio");
  const editLine = useEditBudgetLine(year);
  const accept = useAcceptBudget(year);
  const grid =
    gridQuery.data && gridQuery.data.has_budget ? buildBudgetGrid(gridQuery.data) : null;

  // Plan vs Real por cuenta-mes: una query de budget-by-account por mes cerrado (carga progresiva).
  const realQueries = useQueries({
    queries: periodos.mesesAnio.map((p) =>
      budgetByAccountQueryOptions(p, modo === "anio" && vistaAnual === "real"),
    ),
  });
  const planReal = React.useMemo(
    () => buildPlanRealYear(realQueries.map((q) => q.data as BudgetByAccountResponse | undefined)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [realQueries.map((q) => q.data).join(","), periodos.mesesAnio.length],
  );
  const mesesLabel = React.useMemo(
    () => periodos.mesesAnio.map((p) => mesCorto(p)),
    [periodos.mesesAnio],
  );

  const loading = modo === "mes" ? mesQuery.isLoading : anioQueries.some((q) => q.isLoading);

  const data: PlanReal | null = React.useMemo(() => {
    if (modo === "mes") return mapPlanReal(mesQuery.data, mesCorto(periodos.ultimoCerrado));
    const resps = anioQueries.map((q) => q.data as BudgetVsActualResponse | undefined);
    return agregarPlanReal(resps, `${periodos.year}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, mesQuery.data, anioQueries.map((q) => q.data).join(","), periodos]);

  const hero = data && data.tieneBudget ? heroPresupuesto(data) : null;

  const proponer = (pct: number) => {
    setMetaPct(pct);
    const body =
      pct > 0
        ? { fiscal_year: Number(periodos.year), meta: { revenue: pct } }
        : { fiscal_year: Number(periodos.year) };
    propose.mutate(body);
  };

  const periodoLabel = modo === "mes" ? mesCorto(periodos.ultimoCerrado) : periodos.year;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Top: título + Mes/Año */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-dark">Presupuesto</h1>
          <p className="mt-1 text-sm text-neutral-mid">¿Cómo vas contra tu plan?</p>
        </div>
        <div className="flex rounded-lg bg-neutral-light/40 p-0.5 text-xs" role="tablist">
          {(["mes", "anio"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={modo === m}
              onClick={() => setModo(m)}
              className={cn(
                "rounded-md px-3 py-1 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
                modo === m ? "bg-surface text-neutral-strong shadow-sm" : "text-neutral-mid",
              )}
            >
              {m === "mes" ? "Mes" : "Año"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-56 animate-pulse rounded-xl bg-neutral-light/30" aria-busy="true" />
      ) : !data || !data.tieneBudget ? (
        <EmptyState
          year={periodos.year}
          onProponer={() => proponer(0)}
          pending={propose.isPending}
          error={propose.isError}
        />
      ) : (
        <>
          {/* Franja de origen + ajuste "+% ventas" */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-primary/20 bg-brand-primary/5 px-4 py-2.5 text-sm text-brand-primary">
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Lo armó Qavante desde tu <b className="font-semibold">historial real</b>. Ajústalo con un
              gesto:
            </span>
            <div className="ml-auto flex flex-wrap gap-1.5">
              {META_OPCIONES.map((o) => (
                <button
                  key={o.pct}
                  type="button"
                  disabled={propose.isPending}
                  onClick={() => proponer(o.pct)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
                    metaPct === o.pct
                      ? "border-brand-primary bg-brand-primary text-white"
                      : "border-brand-primary/30 bg-surface text-brand-primary hover:bg-brand-primary/10",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* HERO ¿cómo vas? */}
          {hero && <Hero hero={hero} periodoLabel={periodoLabel} modo={modo} />}

          {/* Lo que se desvía: desglose por CONCEPTO (ventas/costos/gastos) con su desvío real. El
              desglose por CUENTA (marketing, sueldos, software) espera el presupuesto a nivel de cuenta. */}
          <Desvios desvios={desviosPresupuesto(data)} />

          {/* Modo Año: ver el presupuesto EDITABLE (plan) o el PLAN VS REAL por cuenta-mes. */}
          {modo === "anio" && (
            <>
              <div className="flex rounded-lg bg-neutral-light/40 p-0.5 text-xs" role="tablist">
                {(
                  [
                    ["plan", "Presupuesto (editable)"],
                    ["real", "Plan vs Real"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    role="tab"
                    aria-selected={vistaAnual === v}
                    onClick={() => setVistaAnual(v)}
                    className={cn(
                      "rounded-md px-3 py-1 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
                      vistaAnual === v ? "bg-surface text-neutral-strong shadow-sm" : "text-neutral-mid",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {vistaAnual === "plan"
                ? grid && (
                    <BudgetGridView
                      model={grid}
                      saving={editLine.isPending}
                      accepting={accept.isPending}
                      onEditCell={(account_id, impact_type, month, montoSignado) =>
                        editLine.mutate({ account_id, month, amount: montoSignado, impact_type })
                      }
                      onAccept={() => accept.mutate()}
                    />
                  )
                : (
                    <PlanRealYearView
                      model={planReal}
                      meses={mesesLabel}
                      cargando={{
                        hechos: realQueries.filter((q) => q.data).length,
                        total: periodos.mesesAnio.length,
                      }}
                    />
                  )}
            </>
          )}

          {/* Proyección de cierre (Fase 1b) */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-sm">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700">
              <TrendingDown className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="text-sm text-neutral-mid">
              Muy pronto: la proyección de cierre de año y el aviso “vas a pasarte” antes de que ocurra.
            </p>
          </div>

          <p className="pt-1 text-center text-xs text-neutral-mid">
            Presupuesto propositivo · Fase 1 (Resultado). El presupuesto se propone desde tu historial;
            tú lo ajustas y Qavante te avisa antes de que te pases.
          </p>
        </>
      )}
    </div>
  );
}

function Hero({
  hero,
  periodoLabel,
  modo,
}: {
  hero: NonNullable<ReturnType<typeof heroPresupuesto>>;
  periodoLabel: string;
  modo: "mes" | "anio";
}) {
  const sem = SEMAFORO[hero.semaforo];
  const abajo = hero.variacion < 0;
  const max = Math.max(1, hero.ventas, hero.gastoReal, hero.gastoPlan);
  const barra = [
    { label: "Ventas", valor: hero.ventas, ancho: (hero.ventas / max) * 100, tono: "bg-success-700" },
    {
      label: "Costos + gastos (real)",
      valor: hero.gastoReal,
      ancho: (hero.gastoReal / max) * 100,
      tono: hero.gastoOver ? "bg-amber-500" : "bg-brand-primary",
    },
    {
      label: "Presupuesto de gasto",
      valor: hero.gastoPlan,
      ancho: (hero.gastoPlan / max) * 100,
      tono: "bg-neutral-mid/50",
    },
  ];

  return (
    <QavanteCard variant="bordered">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-lg font-bold capitalize text-neutral-dark">
          {modo === "mes" ? `¿Cómo vas en ${periodoLabel}?` : "¿Cómo vas en el año?"}
        </span>
        {hero.variacionPct != null && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
              sem.pill,
            )}
          >
            <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
            {hero.variacionPct > 0 ? "+" : ""}
            {hero.variacionPct}% vs plan
          </span>
        )}
      </div>

      <div className="mt-3 grid gap-5 sm:grid-cols-[1.1fr_1fr] sm:items-center">
        <div>
          <p
            className={cn(
              "text-4xl font-extrabold tabular-nums tracking-tight",
              hero.resultadoReal < 0 ? "text-danger-500" : "text-neutral-strong",
            )}
          >
            {hero.resultadoReal < 0 ? "−" : ""}
            {formatClp(Math.abs(hero.resultadoReal))}
          </p>
          <p className="mt-2 text-sm text-neutral-mid">
            Tu resultado. Presupuestaste{" "}
            <b className="text-neutral-dark">{formatClp(hero.resultadoPlan)}</b>: vas{" "}
            <b className={abajo ? "text-danger-500" : "text-success-700"}>
              {formatClp(Math.abs(hero.variacion))} {abajo ? "abajo" : "arriba"}
            </b>{" "}
            del plan.
          </p>
        </div>

        <div className="flex flex-col gap-2.5" aria-hidden="true">
          {barra.map((b) => (
            <div key={b.label}>
              <div className="flex items-baseline justify-between text-[11px] text-neutral-mid">
                <span>{b.label}</span>
                <span className="font-semibold tabular-nums text-neutral-dark">
                  {formatClp(b.valor)}
                </span>
              </div>
              <div className="mt-1 h-2.5 rounded-full bg-neutral-light/40">
                <div
                  className={cn("h-full rounded-full", b.tono)}
                  style={{ width: `${Math.max(2, b.ancho)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </QavanteCard>
  );
}

/** "Lo que se desvía": una fila por concepto (Ingresos / Costo directo / Gastos), con cuánto y hacia
 *  dónde se fue el desvío, ordenadas peor-primero. Datos reales de budget-vs-actual (no placeholder). */
function Desvios({ desvios }: { desvios: DesvioLinea[] }) {
  return (
    <QavanteCard variant="bordered" header={<span className="font-medium">Lo que se desvía</span>}>
      {desvios.length === 0 ? (
        <p className="py-2 text-sm text-neutral-mid">
          Vas clavado al plan: ninguna línea se desvía todavía.
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {desvios.map((d) => {
            const esIngreso = d.concepto === "revenue";
            const verbo = esIngreso ? "Vendiste" : "Gastaste";
            const palabra = esIngreso
              ? d.favorable
                ? "más"
                : "menos"
              : d.favorable
                ? "menos"
                : "más";
            return (
              <li key={d.concepto} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-dark">{d.label}</p>
                  <p className="mt-0.5 text-xs text-neutral-mid">
                    {verbo}{" "}
                    <b className="tabular-nums text-neutral-dark">
                      {formatClp(Math.abs(d.variacion))}
                    </b>{" "}
                    {palabra} de lo presupuestado.{" "}
                    <span className="text-neutral-mid/80">
                      Plan {formatClp(Math.abs(d.plan))} · Real {formatClp(Math.abs(d.real))}
                    </span>
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums",
                    d.favorable
                      ? "bg-success-700/10 text-success-700"
                      : "bg-danger-500/10 text-danger-500",
                  )}
                >
                  {d.favorable ? "a favor" : "en contra"}
                  {d.variacionPct != null ? ` · ${Math.abs(d.variacionPct)}%` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="pt-3 text-xs text-neutral-mid">
        El desglose por cuenta (marketing, sueldos, software) llega cuando habilitemos el presupuesto a
        nivel de cuenta.
      </p>
    </QavanteCard>
  );
}

function EmptyState({
  year,
  onProponer,
  pending,
  error,
}: {
  year: string;
  onProponer: () => void;
  pending: boolean;
  error: boolean;
}) {
  return (
    <QavanteCard variant="bordered">
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-primary/10 text-brand-primary">
          <Sparkles className="h-6 w-6" aria-hidden="true" />
        </span>
        <div>
          <p className="text-lg font-bold text-neutral-dark">Todavía no tienes presupuesto {year}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-neutral-mid">
            No lo llenas a mano. Qavante te lo <b className="text-neutral-strong">propone desde tu
            historial real</b> (tendencia, estacionalidad y gastos recurrentes) y después lo ajustas con
            un gesto.
          </p>
        </div>
        <button
          type="button"
          onClick={onProponer}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-primary/90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {pending ? "Proponiendo…" : "Proponer presupuesto"}
        </button>
        {error && (
          <p className="text-xs text-danger-500">
            No pudimos proponer el presupuesto ahora. Vuelve a intentar en un momento.
          </p>
        )}
      </div>
    </QavanteCard>
  );
}
