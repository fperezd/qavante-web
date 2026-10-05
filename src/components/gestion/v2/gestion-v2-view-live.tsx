"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Info, CalendarClock } from "lucide-react";
import { useOperationalResultBreakdown, type OperationalResultResponse } from "@/lib/api/gestion";
import { useDashboardSummary } from "@/lib/api/dashboard";
import { parseAmount } from "../gestion-format";
import { formatClp } from "@/lib/formatters/clp";
import { GestionV2View, type GestionMovible } from "./gestion-v2-view";
import { GestionDashboardGrid } from "./gestion-dashboard-grid";
import { ResultadoHero } from "./resultado-hero";
import { CascadaResultado } from "./cascada-resultado";
import { DriversResultado } from "./drivers-resultado";
import { TendenciaResultado } from "./tendencia-resultado";
import { PulsoTira } from "./pulso-tira";
import { resolvePulsoPresentation } from "./pulso-status";
import {
  mapHero,
  mapComparativos,
  mapCascada,
  mapDrivers,
  mapTendencia,
  separarMesEnCurso,
  margenOperacionalPct,
  resultadoConfiable,
  resultAbstained,
  fuentesPendientes,
  tendenciaConfiable,
  type Comparativo,
} from "./gestion-v2-map";
import { AlertTriangle } from "lucide-react";
import { formatPct } from "@/lib/formatters/pct";
import { MESES_LARGOS } from "@/lib/formatters/months";

/* Vista LIVE de Gestión v2 (rediseño 2026-07-14), la única vista de Gestión (el clásico se retiró). Recibe el
   resultado del mes (ya resuelto por el container `OperationalResultView`) y compone la vista:
   hero (respuesta de dueño) + márgenes + comparativos + la cascada del resultado + drivers +
   la tendencia de margen (del breakdown por rango) + la tira del Pulso (mismo dato del header).
   Degradación honesta: la tendencia se omite si el breakdown falla o no trae el %; el Pulso si
   el dashboard no está; se conserva el pie de confianza + fuentes faltantes (§13, no asume 0).
   Container: NO se testea por Storybook play (ADR-0018); la lógica vive en `gestion-v2-map`. */

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

  // ABSTENCIÓN: el productor publica `result: null` + `abstention_reason` (qavante-api#888) porque
  // una fuente requerida no cubre el mes. `parseAmount(null)` daría `0` y el hero afirmaría "ganó
  // $0" con la variación medida contra ese cero. No se muestra veredicto ni variación; se muestran
  // las líneas que SÍ acreditan el mes y qué fuente falta (#318).
  if (resultAbstained(mes)) return <ResultadoAbstenido mes={mes} period={period} />;

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
  const pulsoPresentation = pulso ? resolvePulsoPresentation(pulso.status) : null;

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
  const pulsoNode =
    pulso && pulsoPresentation ? (
      <PulsoTira
        score={pulso.score}
        estado={pulsoPresentation.estado}
        tono={pulsoPresentation.tono}
        insight={insightTension(hero.resultado, pulso.status)}
        onVer={() => router.push("/alertas")}
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
function insightTension(resultado: number, status: string | null): React.ReactNode {
  /* Los dos casos de `!known` NO son el mismo, y decirlo igual deshace la distinción que
     `pulso-status.ts` gastó un estado entero en separar — y que `pulso-sin-dato.test.ts` fija.

     `null` es la API abstenida: no se pudo calcular, y el chip de al lado dice "sin datos
     suficientes". Decir "pendiente de actualizar" ahí contradice al chip a dos centímetros. */
  if (status == null) {
    return (
      <>
        El resultado del mes fue {resultado >= 0 ? "positivo" : "negativo"}. Todavía no se puede
        calcular el Pulso, así que no hay lectura que cruzar con este resultado.
      </>
    );
  }
  if (!resolvePulsoPresentation(status).known) {
    return (
      <>
        El resultado del mes fue {resultado >= 0 ? "positivo" : "negativo"}. La lectura del Pulso
        está pendiente de actualizar; no la interpretamos como un estado conocido.
      </>
    );
  }
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
      {formatClp(monto)} · <span className="text-neutral-mid">{formatPct(pct)}</span>
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

/** Pie de confianza + fuentes faltantes (§13: no se asume 0). Va como footer con label y separador
 *  para que califique al resultado con contexto — antes era un chip suelto huérfano (auditoría UX F-09). */
function ConfianzaPie({ mes }: { mes: OperationalResultResponse }) {
  if (!mes.missing_sources?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3 text-xs text-neutral-mid">
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

/** ABSTENCIÓN del productor (`result: null` + `abstention_reason`, qavante-api#888): una fuente
 *  requerida no cubre el período, así que el RESULTADO del mes no es publicable.
 *
 *  Dos reglas se cruzan acá y las dos se respetan (web#318 + decisión de copy de Fernando
 *  2026-10-01):
 *
 *  1. No fabricar. `parseAmount(null)` da `0`, y mostrar ese cero como resultado afirmaba "El
 *     negocio ganó este mes · $0" y comparaba el mes anterior contra él. Ese veredicto y esa
 *     variación NO se renderizan — es el defecto que abrió el issue.
 *  2. No dejar al dueño sin número. Tampoco corresponde un cartel de "no disponible": las
 *     palabras de incertidumbre ensucian cifras que sí están medidas y dejan al lector sin nada
 *     para decidir. Así que mostramos las líneas que SÍ acreditan el mes (ventas, costos directos
 *     y margen bruto, todas publicadas por el contrato).
 *  3. El encabezado es la ACCIÓN, no el estado: qué tiene que hacer el dueño mañana para cerrar el
 *     mes, con el botón que lleva a hacerlo. Las `integrity.reasons` son causas técnicas ("rcv
 *     purchases sin sincronizar para 2026-08") y NO se pintan: viven en la API y la auditoría. Lo
 *     que llega a pantalla es la fuente a conectar, que es lo único accionable. */
export function ResultadoAbstenido({
  mes,
  period,
}: {
  mes: OperationalResultResponse;
  period: string;
}) {
  const nombreMes = mesLargo(period);
  const pendientes = fuentesPendientes(mes);
  const ventas = parseAmount(mes.revenue);
  const costosDirectos = parseAmount(mes.direct_cost);
  const bruto = parseAmount(mes.gross_margin);
  const brutoPct = parseAmount(mes.gross_margin_pct);
  const row = (k: string, v: React.ReactNode) => (
    <div className="flex items-baseline justify-between gap-3 border-t border-dashed border-border py-1.5">
      <dt className="text-neutral-mid">{k}</dt>
      <dd className="font-bold tabular-nums text-neutral-dark">{v}</dd>
    </div>
  );
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-brand-primary/25 bg-brand-primary/[.05] p-6">
        <div className="flex items-start gap-3">
          <CalendarClock
            className="mt-0.5 h-5 w-5 shrink-0 text-brand-primary"
            aria-hidden="true"
          />
          <div className="w-full space-y-3">
            <h2 className="text-base font-bold text-neutral-dark">
              {pendientes
                ? `Conecta ${pendientes} para cerrar el resultado de ${nombreMes}`
                : `Sincroniza ${nombreMes} para cerrar el resultado del mes`}
            </h2>
            <p className="text-sm text-neutral-mid">
              Esto es lo que ya está acreditado de {nombreMes}. Falta plata que resta, así que el
              resultado del mes y la comparación con el mes anterior se publican cuando{" "}
              {pendientes ?? "la fuente pendiente"} cubra el período.
            </p>
            <dl className="flex flex-col text-[13px]">
              {row("Ventas del mes", formatClp(ventas))}
              {row("Costos directos", `−${formatClp(Math.abs(costosDirectos))}`)}
              {row(
                "Margen bruto",
                <>
                  {formatClp(bruto)} ·{" "}
                  <span className="text-neutral-mid">{formatPct(brutoPct)}</span>
                </>,
              )}
            </dl>
            <p className="text-[13px] text-neutral-mid">
              Cubre las ventas emitidas y los costos directos de {nombreMes}. El resultado final
              resta además las remuneraciones, los honorarios y los gastos recurrentes del mes.
            </p>
            <Link
              href="/conexiones"
              className="inline-flex items-center rounded-lg bg-brand-primary px-3 py-2 text-[13px] font-bold text-white hover:opacity-90"
            >
              Ir a Conexiones
            </Link>
          </div>
        </div>
      </section>
      <ConfianzaPie mes={mes} />
    </div>
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
          El resultado requiere revisión
        </p>
        <p className="mt-2 text-[13px] text-neutral-dark">
          El resultado del mes iguala o supera a tus ingresos y necesita revisión. Revisa el detalle
          de ingresos, costos y gastos del período antes de usar esta cifra; no la mostramos como un
          resultado confirmado.
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
