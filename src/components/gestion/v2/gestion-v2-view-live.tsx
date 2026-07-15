"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";
import { QavanteBadge } from "@/components/qavante";
import { useOperationalResultBreakdown, type OperationalResultResponse } from "@/lib/api/gestion";
import { useDashboardSummary, type PulsoStatus } from "@/lib/api/dashboard";
import { parseAmount, formatSignedPct } from "../gestion-format";
import { formatClp } from "@/lib/formatters/clp";
import { GestionV2View, type GestionMovible } from "./gestion-v2-view";
import { ResultadoHero } from "./resultado-hero";
import { CascadaResultado } from "./cascada-resultado";
import { DriversResultado } from "./drivers-resultado";
import { TendenciaResultado } from "./tendencia-resultado";
import { PulsoTira, type PulsoTono } from "./pulso-tira";
import { mapHero, mapComparativos, mapCascada, mapDrivers, mapTendencia, margenOperacionalPct, type Comparativo } from "./gestion-v2-map";

/* Vista LIVE de Gestión v2 (rediseño 2026-07-14), gated por `gestionV2` (OFF). Recibe el
   resultado del mes (ya resuelto por el container `OperationalResultView`) y compone la vista:
   hero (respuesta de dueño) + márgenes + comparativos + la cascada del resultado + drivers +
   la tendencia de margen (del breakdown por rango) + la tira del Pulso (mismo dato del header).
   Degradación honesta: la tendencia se omite si el breakdown falla o no trae el %; el Pulso si
   el dashboard no está; se conserva el pie de confianza + fuentes faltantes (§13, no asume 0).
   Container: NO se testea por Storybook play (ADR-0018); la lógica vive en `gestion-v2-map`. */

const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
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

export function GestionV2ViewLive({ mes, period }: { mes: OperationalResultResponse; period: string }) {
  const router = useRouter();
  const { from, to } = rango6(period);
  const breakdown = useOperationalResultBreakdown(from, to, { enabled: true });
  const dash = useDashboardSummary();

  const hero = mapHero(mes);
  const comparativos = mapComparativos(mes);
  const cascada = mapCascada(mes);
  const drivers = mapDrivers(mes);
  const tendencia = breakdown.data ? mapTendencia(breakdown.data) : [];
  const pulso = dash.data?.pulso ?? null;

  const movibles: GestionMovible[] = [
    { id: "drivers", label: "Qué explica el resultado", node: <DriversResultado items={drivers} /> },
  ];
  if (tendencia.length >= 2) {
    movibles.push({ id: "tendencia", label: "Margen en el tiempo", node: <TendenciaResultado puntos={tendencia} /> });
  }

  return (
    <div className="space-y-4">
      <GestionV2View
        hero={
          <ResultadoHero
            titulo={hero.titulo}
            resultado={hero.resultado}
            respuesta={hero.respuesta}
            respuestaTono={hero.respuestaTono}
            subtitulo={`Resultado operacional de ${mesLargo(period)} · devengado`}
            infoHint="Lo facturado menos los costos y gastos del mes. Es devengado — no es lo cobrado ni la caja."
          />
        }
        margenes={<Margenes mes={mes} />}
        comparativos={<Comparativos items={comparativos} />}
        cascada={<CascadaResultado entradas={cascada} />}
        movibles={movibles}
        pulso={
          pulso ? (
            <PulsoTira
              score={pulso.score}
              estado={PULSO_ESTADO[pulso.status]}
              tono={PULSO_TONO[pulso.status]}
              insight={insightTension(hero.resultado, pulso.status)}
              onVer={() => router.push("/gestion/pulso")}
            />
          ) : undefined
        }
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
        Ganas en resultado, pero tu Pulso está {status === "critical" ? "crítico" : "débil"}. El resultado es{" "}
        <b>devengado</b> — lo facturado, no lo cobrado.
      </>
    );
  }
  if (resultado < 0) {
    return <>El resultado del mes fue negativo. Mira qué lo explica y cómo viene tu caja.</>;
  }
  return <>Resultado positivo y Pulso {status === "strong" ? "fuerte" : "estable"}: el negocio viene sólido.</>;
}

function Margenes({ mes }: { mes: OperationalResultResponse }) {
  const row = (k: string, v: React.ReactNode, dashed = true) => (
    <div className={`flex items-baseline justify-between gap-3 py-1.5 ${dashed ? "border-t border-dashed border-border" : ""}`}>
      <dt className="text-neutral-mid">{k}</dt>
      <dd className="font-bold tabular-nums text-neutral-dark">{v}</dd>
    </div>
  );
  return (
    <div className="p-5">
      <p className="text-[11.5px] font-bold uppercase tracking-wide text-neutral-mid">Márgenes</p>
      <dl className="mt-2 flex flex-col text-[12.5px]">
        {row(
          "Margen bruto",
          <>
            {formatClp(parseAmount(mes.gross_margin))} · <span className="text-neutral-mid">{fmtPct(parseAmount(mes.gross_margin_pct))}</span>
          </>,
          false,
        )}
        {row("Margen operacional", fmtPct(margenOperacionalPct(mes)))}
        {row("EBITDA (proxy)", formatClp(parseAmount(mes.ebitda_proxy)))}
      </dl>
    </div>
  );
}

function Comparativos({ items }: { items: Comparativo[] }) {
  return (
    <div className="p-5">
      <p className="text-[11.5px] font-bold uppercase tracking-wide text-neutral-mid">Cómo viene el ritmo</p>
      {items.length === 0 ? (
        <p className="mt-2 text-[12px] text-neutral-mid">Sin períodos anteriores para comparar todavía.</p>
      ) : (
        <dl className="mt-2.5 flex flex-col gap-2.5 text-[12.5px]">
          {items.map((c) => (
            <div key={c.label} className="flex items-baseline justify-between gap-3">
              <dt className="text-neutral-mid">{c.label}</dt>
              <dd className={`font-bold ${c.pct >= 0 ? "text-success-700" : "text-danger-500"}`}>{formatSignedPct(String(c.pct))}</dd>
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
const CONF_VARIANT: Record<OperationalResultResponse["confidence"], "success" | "warning" | "danger"> = {
  high: "success",
  medium: "warning",
  low: "danger",
};

/** Pie de confianza + fuentes faltantes (§13: no se asume 0). */
function ConfianzaPie({ mes }: { mes: OperationalResultResponse }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-mid">
      <QavanteBadge variant={CONF_VARIANT[mes.confidence]}>{CONF_LABEL[mes.confidence]}</QavanteBadge>
      {mes.missing_sources.length > 0 && (
        <span className="inline-flex items-center gap-1">
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
          Faltan fuentes: {mes.missing_sources.join(", ")} (no se asumen en cero)
        </span>
      )}
    </div>
  );
}

function fmtPct(v: number): string {
  return `${v.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
