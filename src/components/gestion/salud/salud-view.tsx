"use client";

import * as React from "react";
import {
  Receipt,
  Clock,
  TrendingUp,
  ShieldCheck,
  Coins,
  UserPlus,
  Landmark,
  Package,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/lib/hooks/use-count-up";
import { PulsoRing } from "@/components/inicio/pulso-ring";
import { QavanteCard, QavanteBadge } from "@/components/qavante";
import type { PulsoStatus } from "@/lib/api/dashboard";
import type {
  SaludModel,
  ScoreComponent,
  SaludDriver,
  SaludDecision,
  PulsoBand,
  QhsBand,
  Quadrant,
  CashPoint,
} from "./salud-model";

/* PROTOTIPO UX — pantalla "Salud" (PULSO + Health Score, ADR-0064).
   Presentacional puro: recibe un `SaludModel` y renderiza. NO cableado a rutas
   ni a la API (cero impacto en prod). Reutiliza `PulsoRing`, `QavanteCard`,
   `QavanteBadge` y `useCountUp`. Vocabulario según §8 "Diccionario de UI" de la
   spec: la pantalla habla el idioma del dueño (pesos, no ratios; preguntas, no
   sustantivos técnicos). */

/* ── Mapeos banda → color/estado ─────────────────────────────── */

const PULSO_BAND_TO_STATUS: Record<PulsoBand, PulsoStatus> = {
  holgado: "strong",
  estable: "stable",
  ajustado: "weak",
  tenso: "weak",
  critico: "critical",
};

const PULSO_BAND_LABEL: Record<PulsoBand, string> = {
  holgado: "Holgado",
  estable: "Estable",
  ajustado: "Ajustado",
  tenso: "Tenso",
  critico: "Crítico",
};

const QHS_BAND: Record<QhsBand, { label: string; tone: "success" | "warning" | "danger" }> = {
  muy_sana: { label: "Muy sana", tone: "success" },
  sana_alertas: { label: "Sana con alertas", tone: "success" },
  observacion: { label: "En observación", tone: "warning" },
  vulnerable: { label: "Vulnerable", tone: "warning" },
  riesgo_alto: { label: "Riesgo alto", tone: "danger" },
};

/** Color CSS de una barra de componente según su valor (bandas del Pulso). */
function barColor(v: number): string {
  if (v >= 70) return "var(--color-success-500)";
  if (v >= 55) return "var(--color-warning-500)";
  if (v >= 40) return "var(--color-pulso-vulnerable)";
  return "var(--color-danger-500)";
}

const DRIVER_ICON = {
  tax: Receipt,
  clock: Clock,
  trend: TrendingUp,
  shield: ShieldCheck,
  coins: Coins,
} as const;

const DECISION_ICON = {
  person: UserPlus,
  bank: Landmark,
  box: Package,
  coins: Coins,
} as const;

const DRIVER_TONE_CLASS: Record<SaludDriver["tone"], { tile: string; stripe: string }> = {
  bad: { tile: "bg-danger-50 text-danger-700", stripe: "bg-danger-500" },
  warn: { tile: "bg-warning-50 text-warning-700", stripe: "bg-warning-500" },
  ok: { tile: "bg-success-50 text-success-700", stripe: "bg-success-500" },
};

const VERDICT_VARIANT: Record<SaludDecision["verdict"], "success" | "warning" | "danger"> = {
  si: "success",
  margen_justo: "warning",
  todavia_no: "warning",
  no_por_ahora: "danger",
};

/* ── Sub-componentes ─────────────────────────────────────────── */

function SectionHead({ eyebrow, question }: { eyebrow: string; question: string }) {
  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-neutral-mid">
        <span className="h-0.5 w-4 rounded-full bg-brand-primary" aria-hidden="true" />
        {eyebrow}
      </div>
      <h2 className="mt-1.5 text-[17px] font-bold tracking-tight text-neutral-dark text-balance">
        {question}
      </h2>
    </div>
  );
}

function ComponentBars({ rows }: { rows: ScoreComponent[] }) {
  return (
    <div className="flex flex-1 flex-col gap-3">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[9rem_1fr_2rem] items-center gap-3">
          <span className="flex items-baseline gap-1.5 text-xs leading-tight text-neutral-mid">
            <b className="font-semibold text-neutral-dark">{r.label}</b>
            <span className="text-[10px] text-neutral-mid">{Math.round(r.weight * 100)}%</span>
          </span>
          <span className="h-2 overflow-hidden rounded-full bg-neutral-light/40">
            <i
              className="block h-full rounded-full"
              style={{ width: `${r.value}%`, background: barColor(r.value) }}
            />
          </span>
          <span className="text-right text-xs font-semibold tabular-nums text-neutral-dark">
            {r.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Proyección diaria de caja a 30 días con el mínimo seguro y el día de apretón. */
function CashSparkline({
  cash,
  cashMin,
  breachDay,
  recoveryDay,
}: {
  cash: CashPoint[];
  cashMin: number;
  breachDay: number | null;
  recoveryDay: number | null;
}) {
  const W = 560,
    H = 120,
    L = 34,
    R = 10,
    T = 12,
    B = 22;
  const maxV = Math.max(cashMin + 1, ...cash.map((p) => p.amount)) + 1;
  const minV = Math.min(0, ...cash.map((p) => p.amount)) - 0.5;
  const sx = (day: number) => L + ((W - L - R) * day) / 30;
  const sy = (v: number) => T + (H - T - B) * (1 - (v - minV) / (maxV - minV));
  const line = cash
    .map((p, i) => `${i ? "L" : "M"}${sx(p.day).toFixed(1)} ${sy(p.amount).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${sx(30).toFixed(1)} ${sy(minV)} L${sx(0).toFixed(1)} ${sy(minV)} Z`;
  const at = (day: number) => {
    const exact = cash.find((p) => p.day === day);
    if (exact) return exact.amount;
    return cash[cash.length - 1]?.amount ?? 0;
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Caja proyectada a 30 días"
    >
      <defs>
        <linearGradient id="qv-cashg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-brand-light)" stopOpacity="0.3" />
          <stop offset="1" stopColor="var(--color-brand-light)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <rect
        x={L}
        y={sy(cashMin)}
        width={W - L - R}
        height={Math.max(0, sy(minV) - sy(cashMin))}
        fill="var(--color-danger-500)"
        opacity={0.05}
      />
      <path d={area} fill="url(#qv-cashg)" />
      <line
        x1={L}
        y1={sy(cashMin)}
        x2={W - R}
        y2={sy(cashMin)}
        stroke="var(--color-danger-500)"
        strokeWidth={1.3}
        strokeDasharray="4 4"
        opacity={0.6}
      />
      <text
        x={W - R}
        y={sy(cashMin) - 5}
        fontSize={9}
        textAnchor="end"
        fill="var(--color-danger-700)"
      >
        mínimo seguro ${cashMin.toLocaleString("es-CL")}M
      </text>
      <path
        d={line}
        fill="none"
        stroke="var(--color-brand-light)"
        strokeWidth={2.2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {breachDay !== null && (
        <>
          <circle
            cx={sx(breachDay)}
            cy={sy(at(breachDay))}
            r={5}
            fill="var(--color-warning-500)"
            stroke="var(--color-surface)"
            strokeWidth={2}
          />
          <text
            x={sx(breachDay)}
            y={sy(at(breachDay)) + 17}
            fontSize={9}
            fontWeight={700}
            textAnchor="middle"
            fill="var(--color-warning-700)"
          >
            día {breachDay}
          </text>
        </>
      )}
      {recoveryDay !== null && (
        <>
          <circle
            cx={sx(recoveryDay)}
            cy={sy(at(recoveryDay))}
            r={4.5}
            fill="var(--color-success-500)"
            stroke="var(--color-surface)"
            strokeWidth={2}
          />
          <text
            x={sx(recoveryDay)}
            y={sy(at(recoveryDay)) - 9}
            fontSize={9}
            fontWeight={600}
            textAnchor="middle"
            fill="var(--color-success-700)"
          >
            + cobro esperado
          </text>
        </>
      )}
      <text x={sx(0)} y={H - 6} fontSize={9} fill="var(--color-neutral-mid)">
        hoy
      </text>
      <text x={sx(30)} y={H - 6} fontSize={9} textAnchor="end" fill="var(--color-neutral-mid)">
        día 30
      </text>
    </svg>
  );
}

const QHS_BANDS_Y: { lo: number; hi: number; fill: string }[] = [
  { lo: 70, hi: 84, fill: "var(--color-success-500)" },
  { lo: 55, hi: 69, fill: "var(--color-warning-500)" },
];

/** Serie mensual del Health Score con bandas de estado. */
function TrendChart({ trend }: { trend: SaludModel["trend"] }) {
  const W = 640,
    H = 230,
    L = 34,
    R = 16,
    T = 14,
    B = 30;
  const y0 = 40,
    y1 = 90;
  const ty = (v: number) => T + (H - T - B) * (1 - (v - y0) / (y1 - y0));
  const n = trend.length;
  const pts = trend.map((p, i) => ({
    x: L + ((W - L - R) * i) / Math.max(1, n - 1),
    y: ty(p.value),
  }));
  if (pts.length === 0) return null;
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  let line = `M${first.x.toFixed(1)} ${first.y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!,
      b = pts[i + 1]!;
    const mx = (a.x + b.x) / 2;
    line += ` C${mx.toFixed(1)} ${a.y.toFixed(1)} ${mx.toFixed(1)} ${b.y.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }
  const area = `${line} L${last.x.toFixed(1)} ${ty(y0)} L${first.x.toFixed(1)} ${ty(y0)} Z`;
  const lastValue = trend[trend.length - 1]!.value;
  const tx = (i: number) => L + ((W - L - R) * i) / Math.max(1, n - 1);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={`Health Score por cierre de mes, cerrando en ${lastValue}`}
    >
      <defs>
        <linearGradient id="qv-qhsg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-brand-primary)" stopOpacity="0.16" />
          <stop offset="1" stopColor="var(--color-brand-primary)" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {QHS_BANDS_Y.map((b) => (
        <rect
          key={b.lo}
          x={L}
          y={ty(b.hi)}
          width={W - L - R}
          height={Math.max(0, ty(b.lo) - ty(b.hi))}
          fill={b.fill}
          opacity={0.06}
        />
      ))}
      {[40, 50, 60, 70, 80, 90].map((v) => (
        <g key={v}>
          <line
            x1={L}
            y1={ty(v)}
            x2={W - R}
            y2={ty(v)}
            stroke="var(--color-border)"
            strokeWidth={1}
          />
          <text
            x={L - 8}
            y={ty(v) + 3}
            fontSize={9.5}
            textAnchor="end"
            fill="var(--color-neutral-mid)"
          >
            {v}
          </text>
        </g>
      ))}
      {trend.map(
        (p, i) =>
          i % 2 === 0 && (
            <text
              key={p.month}
              x={tx(i)}
              y={H - 9}
              fontSize={9.5}
              textAnchor="middle"
              fill="var(--color-neutral-mid)"
            >
              {p.month}
            </text>
          ),
      )}
      <path d={area} fill="url(#qv-qhsg)" />
      <path
        d={line}
        fill="none"
        stroke="var(--color-brand-primary)"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last.x} cy={last.y} r={10} fill="var(--color-brand-primary)" opacity={0.18} />
      <circle
        cx={last.x}
        cy={last.y}
        r={5.5}
        fill="var(--color-brand-primary)"
        stroke="var(--color-surface)"
        strokeWidth={2.5}
      />
      <text
        x={last.x - 4}
        y={last.y - 15}
        fontSize={12.5}
        fontWeight={700}
        textAnchor="end"
        fill="var(--color-brand-primary-700)"
      >
        {lastValue}
      </text>
    </svg>
  );
}

const QUADRANTS: { key: Quadrant; title: string; body: string }[] = [
  {
    key: "apreton",
    title: "Apretón pasajero",
    body: "Empresa sana con la caja justa. Un crédito corto para cruzar el mes es razonable.",
  },
  {
    key: "crecer",
    title: "Crecer e invertir",
    body: "Caja holgada y salud sólida. Negociá desde la fuerza.",
  },
  {
    key: "crisis",
    title: "Crisis",
    body: "Modo sobrevivencia: caja y estructura comprometidas a la vez.",
  },
  {
    key: "desangra",
    title: "Se desangra lento",
    body: "Hoy hay plata, pero el fondo se deteriora. La más traicionera.",
  },
];

/* ── Vista principal ─────────────────────────────────────────── */

export interface SaludViewProps {
  model: SaludModel;
  className?: string;
}

export function SaludView({ model, className }: SaludViewProps) {
  const qhsScore = useCountUp(model.qhs.score, 1000);
  const qhsBand = QHS_BAND[model.qhs.band];

  return (
    <div className={cn("mx-auto flex max-w-[1180px] flex-col gap-5 p-6", className)}>
      {/* Encabezado */}
      <header className="rounded-2xl bg-gradient-brand p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 text-[12.5px]">
          <span className="font-bold">
            Qavante<span className="text-brand-light">.</span>
          </span>
          <span className="opacity-70">
            Gestión / <strong className="font-semibold text-white">Salud</strong>
          </span>
          <span className="ml-auto flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-brand-light" aria-hidden="true" />
            {model.tenantName}
          </span>
        </div>
        <h1 className="mt-5 text-[26px] font-bold tracking-tight text-balance">
          Salud de tu empresa
        </h1>
        <p className="mt-1.5 max-w-[60ch] text-sm text-white/65">
          Dos lecturas, un diagnóstico: cómo viene la caja de este mes y hacia dónde va tu empresa.
        </p>
      </header>

      {/* HERO: dos instrumentos */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* PULSO */}
        <QavanteCard variant="elevated" className="p-6">
          <SectionHead
            eyebrow="Pulso · se mide todos los días"
            question="¿Te alcanza la plata este mes?"
          />
          <div className="mt-3 flex flex-wrap items-center gap-6">
            <PulsoRing score={model.pulso.score} status={PULSO_BAND_TO_STATUS[model.pulso.band]} />
            <ComponentBars rows={model.pulso.components} />
          </div>
          <div className="mt-4">
            <CashSparkline
              cash={model.pulso.cash}
              cashMin={model.pulso.cashMin}
              breachDay={model.pulso.breachDay}
              recoveryDay={model.pulso.recoveryDay}
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-mid">
              <b className="text-neutral-dark">Tu caja, proyectada 30 días.</b>{" "}
              {model.pulso.breachDay !== null
                ? `Cruza el mínimo seguro el día ${model.pulso.breachDay}${model.pulso.recoveryDay !== null ? `; se recupera el ${model.pulso.recoveryDay} con el cobro esperado.` : " y no se recupera dentro del mes."}`
                : "Se mantiene sobre el mínimo seguro todo el mes."}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-4 border-t border-border pt-3.5 text-xs text-neutral-mid">
            <span>
              Alertas graves:{" "}
              <b
                className={
                  model.pulso.knockoutsActive
                    ? "font-semibold text-danger-500"
                    : "font-semibold text-success-700"
                }
              >
                {model.pulso.knockoutsActive ? "activa" : "ninguna"}
              </b>
            </span>
            <span>
              Estado:{" "}
              <b className="font-semibold text-neutral-dark">
                {PULSO_BAND_LABEL[model.pulso.band]}
              </b>
            </span>
            <span>
              Actualizado <b className="font-semibold text-neutral-dark">{model.asOf}</b>
            </span>
          </div>
        </QavanteCard>

        {/* HEALTH SCORE */}
        <QavanteCard variant="elevated" className="p-6">
          <SectionHead
            eyebrow="Health Score · se mide al cierre de cada mes"
            question="¿Tu empresa mejora o se deteriora?"
          />
          <div className="mt-3 flex flex-wrap items-start gap-5">
            <div>
              <div className="bg-gradient-brand bg-clip-text text-[58px] font-bold leading-none tracking-tight text-transparent tabular-nums">
                {Math.round(qhsScore)}
              </div>
              <div className="mt-2">
                <QavanteBadge variant={qhsBand.tone}>{qhsBand.label}</QavanteBadge>
              </div>
              <p className="mt-2 text-xs font-semibold text-warning-700 tabular-nums">
                {model.qhs.deltaLabel}
              </p>
            </div>
            <div className="ml-auto max-w-[190px] rounded-xl border border-dashed border-border-strong bg-surface-muted p-3 text-right text-[11.5px] text-neutral-mid">
              <div>Confianza del dato</div>
              <div>
                <span className="text-lg font-bold text-neutral-dark tabular-nums">
                  {model.confidence.score}
                </span>
                {" · "}
                <span className="font-semibold text-success-700">
                  {model.confidence.score >= 80
                    ? "Alta"
                    : model.confidence.score >= 55
                      ? "Media"
                      : "Baja"}
                </span>
              </div>
              <div>Califica el diagnóstico, no la salud.</div>
            </div>
          </div>
          <div className="mt-4">
            <ComponentBars rows={model.qhs.components} />
          </div>
          <div className="mt-4 flex flex-wrap gap-4 border-t border-border pt-3.5 text-xs text-neutral-mid">
            <span>
              Cierre <b className="font-semibold text-neutral-dark">{model.qhs.closingLabel}</b>
            </span>
            <span>
              Próxima medición{" "}
              <b className="font-semibold text-neutral-dark">{model.qhs.nextLabel}</b>
            </span>
          </div>
        </QavanteCard>
      </section>

      {/* Matriz + tendencia */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[5fr_7fr]">
        <QavanteCard className="p-6">
          <SectionHead eyebrow="Lectura conjunta" question="¿Dónde estás parado hoy?" />
          <div className="mt-4 grid grid-cols-2 grid-rows-2 gap-2">
            {QUADRANTS.map((q) => {
              const active = q.key === model.matrix.active;
              return (
                <div
                  key={q.key}
                  className={cn(
                    "min-h-[94px] rounded-xl border p-3 text-[11.5px] leading-relaxed",
                    active
                      ? "border-transparent bg-brand-primary-50 text-neutral-mid shadow-[inset_0_0_0_1.5px_var(--color-brand-primary)]"
                      : "border-border bg-surface-muted text-neutral-mid",
                  )}
                >
                  <b
                    className={cn(
                      "mb-0.5 block text-xs font-semibold",
                      active ? "text-brand-primary-700" : "text-neutral-dark",
                    )}
                  >
                    {q.title}
                  </b>
                  {q.body}
                </div>
              );
            })}
          </div>
          <div className="mt-3 text-[10.5px] uppercase tracking-[0.1em] text-neutral-mid">
            → Pulso (caja del mes) · ↑ Health Score (fondo)
          </div>
          <p className="mt-3.5 max-w-[56ch] text-[12.5px] text-neutral-mid">
            {model.matrix.reading}
          </p>
        </QavanteCard>

        <QavanteCard className="p-6">
          <SectionHead eyebrow="Trayectoria" question="¿Cómo viene la tendencia?" />
          <div className="mt-3">
            <TrendChart trend={model.trend} />
          </div>
          <div className="mt-2.5 flex flex-wrap gap-4 text-[11.5px] text-neutral-mid">
            <span className="flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-sm bg-brand-primary" /> Health Score de cada cierre
              de mes
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-sm bg-success-500/40" /> Sana con alertas (70–84)
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-sm bg-warning-500/40" /> En observación (55–69)
            </span>
          </div>
        </QavanteCard>
      </section>

      {/* Drivers */}
      <QavanteCard className="p-6">
        <SectionHead eyebrow="Causas, con evidencia" question="¿Por qué está así?" />
        <div className="mt-4 flex flex-col gap-2.5">
          {model.drivers.map((d, i) => {
            const Icon = DRIVER_ICON[d.icon];
            const tone = DRIVER_TONE_CLASS[d.tone];
            return (
              <div
                key={i}
                className="flex items-start gap-4 rounded-2xl border border-border bg-surface-muted p-4 transition-shadow hover:shadow-md"
              >
                <span
                  className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", tone.tile)}
                >
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <div className="flex-1">
                  <QavanteBadge
                    variant={
                      d.tone === "bad" ? "danger" : d.tone === "warn" ? "warning" : "success"
                    }
                    className="mr-2 align-middle text-[10px] font-bold uppercase tracking-wide"
                  >
                    {d.category}
                  </QavanteBadge>
                  <h3 className="inline align-middle text-[13.5px] font-semibold text-neutral-dark">
                    {d.title}
                  </h3>
                  <p className="mt-1.5 max-w-[64ch] text-[12.5px] text-neutral-mid">{d.detail}</p>
                  <div className="mt-1.5 text-[11.5px] text-neutral-mid">{d.impact}</div>
                </div>
                <button
                  type="button"
                  className="flex shrink-0 items-center gap-1 self-center rounded-lg border border-brand-primary px-3.5 py-2 text-xs font-semibold text-brand-primary-700 transition-colors hover:bg-brand-primary-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                >
                  {d.cta}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      </QavanteCard>

      {/* Semáforo de decisiones */}
      <QavanteCard className="p-6">
        <SectionHead eyebrow="Semáforo de decisiones" question="¿Puedo tomar esta decisión hoy?" />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {model.decisions.map((d, i) => {
            const Icon = DECISION_ICON[d.icon];
            return (
              <div
                key={i}
                className="rounded-2xl border border-border bg-surface-muted p-4 transition-shadow hover:shadow-md"
              >
                <span className="mb-3 grid h-8 w-8 place-items-center rounded-lg bg-brand-primary-50 text-brand-primary-700">
                  <Icon className="h-[17px] w-[17px]" aria-hidden="true" />
                </span>
                <h4 className="mb-2 text-[13px] font-semibold text-neutral-dark">{d.title}</h4>
                <QavanteBadge variant={VERDICT_VARIANT[d.verdict]} className="font-bold">
                  {d.verdictLabel}
                </QavanteBadge>
                <p className="mt-2.5 text-[11px] leading-relaxed text-neutral-mid">{d.rule}</p>
              </div>
            );
          })}
        </div>
      </QavanteCard>

      {/* Confianza */}
      <QavanteCard className="p-6">
        <SectionHead
          eyebrow={`Confianza del dato: ${model.confidence.score} / 100`}
          question="¿Qué tan confiable es este diagnóstico?"
        />
        <div className="mt-4 grid grid-cols-2 gap-3.5 lg:grid-cols-5">
          {model.confidence.factors.map((f) => (
            <div key={f.label} className="text-[11.5px] text-neutral-mid">
              {f.label} ·{" "}
              <span className="text-sm font-bold text-neutral-dark tabular-nums">{f.value}</span>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-light/40">
                <i
                  className="block h-full rounded-full"
                  style={{
                    width: `${f.value}%`,
                    background:
                      "linear-gradient(90deg, var(--color-brand-light), var(--color-brand-primary))",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 max-w-[70ch] text-[11.5px] text-neutral-mid">{model.confidence.note}</p>
      </QavanteCard>

      <p className="text-center text-[11px] leading-relaxed text-neutral-mid">
        <b className="text-neutral-mid">Prototipo UX</b> · datos ficticios · spec
        pulso-y-health-score-spec-v1 / ADR-0064 · medimos caja, no contabilidad
      </p>
    </div>
  );
}
