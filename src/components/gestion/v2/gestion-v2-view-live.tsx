"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Info, CalendarClock } from "lucide-react";
import { QavanteBadge } from "@/components/qavante";
import { useOperationalResultBreakdown, type OperationalResultResponse } from "@/lib/api/gestion";
import { useDashboardSummary, type PulsoStatus } from "@/lib/api/dashboard";
import { parseAmount } from "../gestion-format";
import { formatClp } from "@/lib/formatters/clp";
import { GestionV2View, type GestionMovible } from "./gestion-v2-view";
import { GestionDashboardGrid } from "./gestion-dashboard-grid";
import { ResultadoHero } from "./resultado-hero";
import { CascadaResultado } from "./cascada-resultado";
import { DriversResultado } from "./drivers-resultado";
import { TendenciaResultado } from "./tendencia-resultado";
import { PulsoTira, type PulsoTono } from "./pulso-tira";
import {
  mapHero,
  mapComparativos,
  mapCascada,
  mapDrivers,
  mapTendencia,
  separarMesEnCurso,
  margenOperacionalPct,
  resultadoConfiable,
  tendenciaConfiable,
  type Comparativo,
} from "./gestion-v2-map";
import { AlertTriangle } from "lucide-react";

/* Vista LIVE de Gestión v2 (rediseño 2026-07-14), la única vista de Gestión (el clásico se retiró). Recibe el
   resultado del mes (ya resuelto por el container `OperationalResultView`) y compone la vista:
   hero (respuesta de dueño) + márgenes + comparativos + la cascada del resultado + drivers +
   la tendencia de margen (del breakdown por rango) + la tira del Pulso (mismo dato del header).
   Degradación honesta: la tendencia se omite si el breakdown falla o no trae el %; el Pulso si
   el dashboard no está; se conserva el pie de confianza + fuentes faltantes (§13, no asume 0).
   Container: NO se testea por Storybook play (ADR-0018); la lógica vive en `gestion-v2-map`. */

const MESES_LARGOS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** "2026-07" → "julio 2026". */
function mesLargo(period: string): string {
  const m = period.match(/^(\d{4})-(\d{2})/);
  if (!m) return period;
  return `${MESES_LARGOS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

/** Rango de 6 meses que termina en `period` (para la tendencia de margen). */
function rango6(period: string): { from: string; to: string } {
  return { from: periodoMenos(period, 5), to: period };
}

/** Resta `n` meses a un período "YYYY-MM" sin usar Date (aritmética pura de calendario). */
function periodoMenos(period: string, n: number): string {
  const m = period.match(/^(\d{4})-(\d{2})/);
  if (!m) return period;
  let y = Number(m[1]);
  let mes = Number(m[2]) - n;
  while (mes <= 0) {
    mes += 12;
    y -= 1;
  }
  return `${y}-${String(mes).padStart(2, "0")}`;
}

const PULSO_ESTADO: Record<PulsoStatus, string> = {
  critical: "Pulso crítico",
  weak: "Pulso débil",
  stable: "Pulso estable",
  strong: "Pulso fuerte",
};
const PULSO_TONO: Record<PulsoStatus, PulsoTono> = {
  critical: "bad",
  weak: "bad",
  stable: "warn",
  strong: "ok",
};

export function GestionV2ViewLive({
  mes,
  period,
  enCurso,
  dashboard = false,
}: {
  mes: OperationalResultResponse;
  period: string;
  enCurso?: boolean;
  /** `gestionDashboard` ON → muestra las secciones como cards movibles/apagables (piloto). OFF = informe. */
  dashboard?: boolean;
}) {
  const router = useRouter();
  const { from, to } = rango6(period);
  const breakdown = useOperationalResultBreakdown(from, to, { enabled: true });
  const dash = useDashboardSummary();

  // MES EN CURSO: los costos ya están devengados pero las ventas recién empiezan → el resultado NO
  // se puede leer aún (daría un "perdió $X" falso). No mostramos veredicto ganó/perdió.
  if (enCurso) return <MesEnCurso mes={mes} period={period} />;

  // El backend está mandando costos en $0 / un resultado > ingresos (margen imposible). NO
  // mostramos la cascada confiada con números absurdos — degradamos honesto y lo dejamos visible.
  if (!resultadoConfiable(mes)) return <DatosIncompletos mes={mes} />;

  const hero = mapHero(mes);
  const comparativos = mapComparativos(mes);
  const cascada = mapCascada(mes);
  const drivers = mapDrivers(mes);
  // El histórico del margen es sobre meses CERRADOS (el mes en curso, parcial, distorsiona el gráfico).
  const tendencia = breakdown.data ? separarMesEnCurso(mapTendencia(breakdown.data)).cerrados : [];
  const pulso = dash.data?.pulso ?? null;

  const movibles: GestionMovible[] = [
    {
      id: "drivers",
      label: "Qué explica el resultado",
      node: <DriversResultado items={drivers} />,
    },
  ];
  // Solo si la serie es plausible (algún mes con margen > 100% = mismo bug de costos $0 → se omite).
  if (tendencia.length >= 2 && tendenciaConfiable(tendencia)) {
    movibles.push({
      id: "tendencia",
      label: "Margen en el tiempo",
      node: <TendenciaResultado puntos={tendencia} />,
    });
  }

  // Nodos de cada sección (reusados por las dos vistas: informe fijo y tablero reordenable).
  const heroNode = (
    <ResultadoHero
      titulo={hero.titulo}
      resultado={hero.resultado}
      respuesta={hero.respuesta}
      respuestaTono={hero.respuestaTono}
      subtitulo={`Resultado operacional de ${mesLargo(period)} (devengado)`}
      infoHint="Lo facturado menos los costos y gastos del mes. Es devengado, no es lo cobrado ni la caja."
    />
  );
  const margenesNode = <Margenes mes={mes} />;
  const comparativosNode = <Comparativos items={comparativos} />;
  const cascadaNode = <CascadaResultado entradas={cascada} />;
  const pulsoNode = pulso ? (
    <PulsoTira
      score={pulso.score}
      estado={PULSO_ESTADO[pulso.status]}
      tono={PULSO_TONO[pulso.status]}
      insight={insightTension(hero.resultado, pulso.status)}
      onVer={() => router.push("/gestion/pulso")}
    />
  ) : null;

  // Piloto `gestionDashboard`: TODAS las secciones como cards movibles/apagables (motor iPad del Inicio).
  // Hero/Márgenes/Comparativos vienen "pelados" → los vestimos de card; cascada/drivers/tendencia/pulso ya
  // son autocontenidos. Confianza queda como pie fijo (es calidad-de-dato, no una card que se mueva).
  if (dashboard) {
    const vestir = (node: React.ReactNode) => (
      <div className="h-full overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        {node}
      </div>
    );
    const items = [
      { id: "hero", label: "Resultado", node: vestir(heroNode), wide: true },
      { id: "margenes", label: "Márgenes", node: vestir(margenesNode) },
      { id: "comparativos", label: "Comparativos", node: vestir(comparativosNode) },
      { id: "cascada", label: "Cascada del resultado", node: cascadaNode },
      ...movibles,
    ];
    // Pulso al pie FIJO (no movible): su "Ver por qué" vive arriba a la derecha, justo donde irían el
    // asa y la "x" → se pisaban. Como Confianza, es una tira de cierre, no una card que se reordene.
    return (
      <div className="space-y-4">
        <GestionDashboardGrid items={items} />
        {pulsoNode}
        <ConfianzaPie mes={mes} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <GestionV2View
        hero={heroNode}
        margenes={margenesNode}
        comparativos={comparativosNode}
        cascada={cascadaNode}
        movibles={movibles}
        pulso={pulsoNode ?? undefined}
      />
      <ConfianzaPie mes={mes} />
    </div>
  );
}

/** Insight de la tira: la tensión resultado (devengado) vs. Pulso (que incluye la caja). */
function insightTension(resultado: number, status: PulsoStatus): React.ReactNode {
  const debil = status === "weak" || status === "critical";
  if (resultado >= 0 && debil) {
    return (
      <>
        Ganas en resultado, pero tu Pulso está {status === "critical" ? "crítico" : "débil"}. El
        resultado es <b>devengado</b>: lo facturado, no lo cobrado.
      </>
    );
  }
  if (resultado < 0) {
    return <>El resultado del mes fue negativo. Mira qué lo explica y cómo viene tu caja.</>;
  }
  return (
    <>
      Resultado positivo y Pulso {status === "strong" ? "fuerte" : "estable"}: el negocio viene
      sólido.
    </>
  );
}

function Margenes({ mes }: { mes: OperationalResultResponse }) {
  const row = (k: string, v: React.ReactNode, dashed = true) => (
    <div
      className={`flex items-baseline justify-between gap-3 py-1.5 ${dashed ? "border-t border-dashed border-border" : ""}`}
    >
      <dt className="text-neutral-mid">{k}</dt>
      <dd className="font-bold tabular-nums text-neutral-dark">{v}</dd>
    </div>
  );
  // Siempre bruto y neto, cada uno en $ y % (pedido de Fernando).
  const margen = (monto: number, pct: number) => (
    <>
      {formatClp(monto)} · <span className="text-neutral-mid">{fmtPct(pct)}</span>
    </>
  );
  return (
    <div className="p-5">
      <p className="text-[11.5px] font-bold uppercase tracking-wide text-neutral-mid">Márgenes</p>
      <dl className="mt-2 flex flex-col text-[12.5px]">
        {row(
          "Margen bruto",
          margen(parseAmount(mes.gross_margin), parseAmount(mes.gross_margin_pct)),
          false,
        )}
        {row("Margen neto", margen(parseAmount(mes.result), margenOperacionalPct(mes)))}
      </dl>
    </div>
  );
}

function Comparativos({ items }: { items: Comparativo[] }) {
  return (
    <div className="p-5">
      <p className="text-[11.5px] font-bold uppercase tracking-wide text-neutral-mid">
        Cómo viene el ritmo
      </p>
      {items.length === 0 ? (
        <p className="mt-2 text-[12px] text-neutral-mid">
          Sin períodos anteriores para comparar todavía.
        </p>
      ) : (
        <dl className="mt-2.5 flex flex-col gap-2.5 text-[12.5px]">
          {items.map((c) => (
            <div key={c.label} className="flex items-baseline justify-between gap-3">
              <dt className="text-neutral-mid">{c.label}</dt>
              <dd className={`font-bold ${c.positivo ? "text-success-700" : "text-danger-500"}`}>
                {c.texto}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

const CONF_LABEL: Record<OperationalResultResponse["confidence"], string> = {
  high: "Confianza alta",
  medium: "Confianza media",
  low: "Confianza baja",
};
const CONF_VARIANT: Record<
  OperationalResultResponse["confidence"],
  "success" | "warning" | "danger"
> = {
  high: "success",
  medium: "warning",
  low: "danger",
};

/** Pie de confianza + fuentes faltantes (§13: no se asume 0). Va como footer con label y separador
 *  para que califique al resultado con contexto — antes era un chip suelto huérfano (auditoría UX F-09). */
function ConfianzaPie({ mes }: { mes: OperationalResultResponse }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3 text-xs text-neutral-mid">
      <span className="font-medium text-neutral-dark">Confianza de este resultado:</span>
      <QavanteBadge variant={CONF_VARIANT[mes.confidence]}>
        {CONF_LABEL[mes.confidence]}
      </QavanteBadge>
      {(mes.missing_sources ?? []).length > 0 && (
        <span className="inline-flex items-center gap-1">
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
          Faltan fuentes: {(mes.missing_sources ?? []).join(", ")} (no se asumen en cero)
        </span>
      )}
    </div>
  );
}

/** Datos incompletos: único disparador = el resultado iguala o supera a los ingresos (margen ≥ 100%,
 *  imposible; típicamente un gasto revertido o mal clasificado infla el resultado). Somos honestos:
 *  no mostramos un resultado con confianza; explicamos qué pasa y dejamos ingresos y resultado a la
 *  vista (para que se vea el desajuste). Escalado al equipo de datos (no se asume 0). */
/** Mes EN CURSO: no hay veredicto ganó/perdió (sería falso — costos completos vs ventas a medias).
 *  Muestra las ventas que llevas + apunta al mes cerrado para el resultado real. */
function MesEnCurso({ mes, period }: { mes: OperationalResultResponse; period: string }) {
  const revenue = parseAmount(mes.revenue);
  return (
    <section className="rounded-xl border border-brand-primary/25 bg-brand-primary/[.05] p-6">
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-brand-primary" aria-hidden="true" />
        <div className="space-y-2">
          <h2 className="text-base font-bold text-neutral-dark">
            {mesLargo(period)} va en curso, aún sin cerrar
          </h2>
          <p className="text-sm text-neutral-mid">
            Todavía no se puede decir si el mes ganó o perdió: los costos ya están cargados, pero
            las ventas del mes recién empiezan. Compararlos ahora daría un resultado falso.
          </p>
          <p className="text-sm text-neutral-dark">
            Ventas del mes hasta ahora: <b className="tabular-nums">{formatClp(revenue)}</b>.
          </p>
          <p className="text-[13px] text-neutral-mid">
            Para el último resultado real, elige el mes anterior en el selector de arriba (la
            pantalla arranca ahí por defecto).
          </p>
        </div>
      </div>
    </section>
  );
}

function DatosIncompletos({ mes }: { mes: OperationalResultResponse }) {
  const revenue = parseAmount(mes.revenue);
  const result = parseAmount(mes.result);
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-warning-500/40 bg-warning-500/[.06] p-5">
        <p className="inline-flex items-center gap-2 text-[13px] font-bold text-warning-700">
          <AlertTriangle className="size-[18px] shrink-0" aria-hidden="true" />
          No podemos mostrar tu resultado con confianza
        </p>
        <p className="mt-2 text-[13px] text-neutral-dark">
          El resultado del mes iguala o supera a tus ingresos, lo que daría un margen imposible
          (100% o más). Suele pasar cuando un gasto se revierte o llega mal clasificado ese mes, así
          que el resultado queda inflado. Es un problema de datos del backend, ya escalado — no lo
          mostramos como si fuera real.
        </p>
        <dl className="mt-3 flex flex-col text-[12.5px]">
          <div className="flex items-baseline justify-between gap-3 py-1">
            <dt className="text-neutral-mid">Ingresos del mes</dt>
            <dd className="font-bold tabular-nums text-neutral-dark">{formatClp(revenue)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-dashed border-warning-500/30 py-1">
            <dt className="text-neutral-mid">Resultado que llegó</dt>
            <dd className="font-bold tabular-nums text-danger-500">{formatClp(result)}</dd>
          </div>
        </dl>
      </section>
      <ConfianzaPie mes={mes} />
    </div>
  );
}

function fmtPct(v: number): string {
  return `${v.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
