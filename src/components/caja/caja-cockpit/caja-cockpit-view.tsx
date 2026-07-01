"use client";

import * as React from "react";
import { AlertTriangle, Clock, Landmark } from "lucide-react";
import { QavanteBadge, QavanteCard } from "@/components/qavante";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateTimeLike } from "@/lib/formatters/date";
import { KpiCell, KpiStrip } from "@/components/proposals/shared/kpi-strip";
import {
  cashCushion14d,
  dataStateLabel,
  parseAmount,
  runwayTone,
  type Tone,
} from "./caja-cockpit-format";
import type { CajaCockpitData } from "./types";

/* Cockpit de Caja — propuesta UX (control de gestión) para el home `/caja`.
 *
 * Hoy `/caja` es un menú de links sin datos. Esta propuesta lo convierte en el
 * tablero que la PYME necesita: responde "¿cuánta plata tengo hoy y me alcanza?"
 * de un vistazo — Saldo hoy · Runway (días de caja) · Alerta de quiebre · Saldo
 * por cuenta. Todos los datos ya los expone el backend (CashToday/CashForecast/
 * CashGap en DashboardSummaryResponse + /api/treasury/bank-accounts); es cablear,
 * no construir backend.
 *
 * Presentacional (props + Storybook). §17.4: no calcula finanzas, solo presenta. */

const BADGE_VARIANT: Record<Tone, "success" | "warning" | "danger" | "default"> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  neutral: "default",
};

const VALUE_COLOR: Record<Tone, string> = {
  success: "text-success-500",
  warning: "text-warning-500",
  danger: "text-danger-500",
  neutral: "text-neutral-dark",
};

const KIND_LABEL: Record<string, string> = {
  checking: "Cuenta corriente",
  savings: "Cuenta de ahorro",
  card: "Tarjeta",
  vista: "Cuenta vista",
};

export function CajaCockpitView({ data }: { data: CajaCockpitData }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-dark">Caja</h1>
        <p className="mt-1 text-sm text-neutral-mid">¿Cuánta plata tengo hoy y me alcanza?</p>
      </div>

      <GapBanner data={data} />

      <CockpitKpis data={data} />

      <BankAccountsCard data={data} />
    </div>
  );
}

/* ── Banner de quiebre de caja ────────────────────────────────────────── */

function GapBanner({ data }: { data: CajaCockpitData }) {
  const gap = data.gap;
  if (!gap || !gap.has_gap) return null;
  const faltante = cashCushion14d(gap.projected_cash_14d, gap.critical_obligations_14d); // negativo
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-danger-500/40 bg-danger-500/5 p-4 text-sm"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger-500" aria-hidden="true" />
      <div>
        <p className="font-medium text-neutral-dark">
          Alerta de caja: en los próximos 14 días no cubres tus obligaciones críticas.
        </p>
        <p className="text-neutral-mid">
          Te faltan <span className="font-semibold text-danger-500">{formatClp(Math.abs(faltante))}</span>{" "}
          (caja proyectada {formatClp(parseAmount(gap.projected_cash_14d))} vs{" "}
          {formatClp(parseAmount(gap.critical_obligations_14d))} en pagos críticos). Prioriza cobranzas
          o posterga pagos no esenciales.
        </p>
      </div>
    </div>
  );
}

/* ── KPIs compactos (Saldo hoy · Runway · Holgura 14d) ────────────────── */

function CockpitKpis({ data }: { data: CajaCockpitData }) {
  const t = data.cash_today;
  const ds = t ? dataStateLabel(t.data_state) : null;
  const days = data.forecast?.days_of_cash ?? null;
  const runwT = runwayTone(days);
  const cushion = data.gap
    ? cashCushion14d(data.gap.projected_cash_14d, data.gap.critical_obligations_14d)
    : null;
  const cushTone: Tone = cushion == null ? "neutral" : cushion < 0 ? "danger" : "success";

  return (
    <KpiStrip>
      <KpiCell
        label="Saldo hoy"
        value={t ? formatClp(parseAmount(t.total)) : "—"}
        sub={
          t && ds ? (
            <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <QavanteBadge variant={BADGE_VARIANT[ds.tone]}>{ds.label}</QavanteBadge>
              <span className="inline-flex items-center gap-1 text-neutral-mid">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {formatDateTimeLike(t.last_updated)}
              </span>
            </span>
          ) : undefined
        }
      />
      <KpiCell
        label="Días de caja"
        value={days != null ? `${days} días` : "—"}
        valueClassName={VALUE_COLOR[runwT]}
        sub={
          days == null
            ? "Sin proyección"
            : runwT === "danger"
              ? "Caja ajustada — actúa ya"
              : runwT === "warning"
                ? "Vigila de cerca"
                : "Caja holgada"
        }
      />
      <KpiCell
        label="Holgura de caja a 14 días"
        value={
          cushion != null
            ? formatClp(cushion)
            : data.forecast
              ? formatClp(parseAmount(data.forecast.min_14d))
              : "—"
        }
        valueClassName={VALUE_COLOR[cushTone]}
        sub={
          cushion != null
            ? cushion < 0
              ? "No cubre pagos críticos"
              : "Cubre tus pagos críticos"
            : "Mínimo proyectado 14d"
        }
      />
    </KpiStrip>
  );
}

/* ── Saldo por cuenta / banco ─────────────────────────────────────────── */

function BankAccountsCard({ data }: { data: CajaCockpitData }) {
  if (data.accounts.length === 0) return null;
  const totalClp = data.accounts
    .filter((a) => a.currency_code === "CLP")
    .reduce((acc, a) => acc + parseAmount(a.balance), 0);
  return (
    <QavanteCard
      variant="bordered"
      header={
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-brand-primary" aria-hidden="true" />
          <span className="font-medium">Saldo por cuenta</span>
        </div>
      }
    >
      <ul className="divide-y divide-border">
        {data.accounts.map((a, i) => (
          <li key={`${a.name}-${i}`} className="flex items-center justify-between gap-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-neutral-dark">{a.name}</p>
              <p className="text-xs text-neutral-mid">
                {KIND_LABEL[a.kind] ?? a.kind} · {a.currency_code}
              </p>
            </div>
            <span className="shrink-0 tabular-nums font-semibold text-neutral-dark">
              {a.currency_code === "CLP"
                ? formatClp(parseAmount(a.balance))
                : `${a.currency_code} ${parseAmount(a.balance).toLocaleString("es-CL")}`}
            </span>
          </li>
        ))}
      </ul>
      {totalClp > 0 && (
        <div className="mt-2 flex items-center justify-between border-t-2 border-border-strong pt-2 text-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
            Total en CLP
          </span>
          <span className="tabular-nums font-semibold text-neutral-dark">{formatClp(totalClp)}</span>
        </div>
      )}
    </QavanteCard>
  );
}
