"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, FileOutput, CircleCheck } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { AmountCountUp } from "@/components/qavante/amount-count-up";
import { InfoHint } from "@/components/ui/info-hint";
import { formatClp } from "@/lib/formatters/clp";
import { formatRut } from "@/lib/formatters/rut";
import { formatDateLike } from "@/lib/formatters/date";
import { cn } from "@/lib/utils";
import type { AgingBar } from "../cobranza-format";
import { CobranzaAcciones } from "./cobranza-acciones";
import { DebtorInvoicesPanel } from "../cobrar-view";
import type { RcvDoc } from "@/components/sii/rcv-grouped-item";

/* CobrarV2View — el armazón presentacional de Cobrar v2 (rediseño 2026-07-19). El
   contenedor (`cobrar-v2-live`) le pasa el hero ya armado + la lista de deudores como
   filas y este solo compone el layout. Testeable en aislamiento (ADR-0018). */

/* Gradiente vertical por segmento (look de "tubo", profundidad premium) sin cambiar la escala
   de color por antigüedad (verde reciente → rojo +90d). */
const AGING_COLOR: Record<string, string> = {
  current: "bg-gradient-to-b from-success-500 to-success-600",
  d1_30: "bg-gradient-to-b from-warning-700/40 to-warning-700/55",
  d31_60: "bg-gradient-to-b from-warning-700/70 to-warning-700/85",
  d61_90: "bg-gradient-to-b from-danger-500/70 to-danger-500/85",
  d90_plus: "bg-gradient-to-b from-danger-500 to-danger-600",
};

export interface CobrarV2ViewProps {
  /** Hero "Cóbrale primero a…" (o el estado "todo gestionado"). */
  hero: React.ReactNode;
  /** Resumen honesto (total + vencido/% o nota de vencimientos pendientes). */
  resumen: React.ReactNode;
  /** Antigüedad de saldos — solo si hay vencimientos (modo urgencia). */
  aging?: AgingBar[];
  /** Filas de deudores (cada una con sus acciones), ya construidas por el contenedor. */
  deudores: React.ReactNode;
  /** Banner de datos parciales (falta sincronizar). */
  banner?: React.ReactNode;
  /** Acceso al Libro de Ventas SII (si `siiQueries`). */
  siiEnabled?: boolean;
}

export function CobrarV2View({
  hero,
  resumen,
  aging,
  deudores,
  banner,
  siiEnabled,
}: CobrarV2ViewProps) {
  return (
    <div className="space-y-4">
      {banner}

      {/* Hero — la respuesta de dueño. */}
      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        {hero}
      </section>

      {resumen}

      {aging && aging.some((b) => b.amount > 0) && <AgingCard bars={aging} />}

      {/* A quién cobrarle — deudores ordenados por prioridad, con acciones. */}
      <QavanteCard
        variant="bordered"
        header={<span className="font-medium">A quién cobrarle</span>}
      >
        {deudores}
      </QavanteCard>

      {siiEnabled && (
        <Link
          href="/cobrar/facturas-emitidas"
          className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
        >
          <QavanteCard
            variant="bordered"
            className="transition-all duration-150 group-hover:-translate-y-0.5 group-hover:border-brand-primary/50 group-hover:shadow-lg"
            header={
              <div className="flex items-center gap-2">
                <FileOutput className="h-4 w-4 text-brand-primary" aria-hidden="true" />
                <span className="font-medium">Libro de Ventas (SII)</span>
              </div>
            }
          >
            <p className="text-sm text-neutral-mid">
              Documentos de venta del SII por período: facturas, notas y boletas emitidas.
            </p>
          </QavanteCard>
        </Link>
      )}
    </div>
  );
}

function AgingCard({ bars }: { bars: AgingBar[] }) {
  return (
    <QavanteCard
      variant="bordered"
      header={<span className="font-medium">Antigüedad de saldos</span>}
    >
      <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-light/40 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]">
        <div className="animate-qv-grow-x flex h-full w-full origin-left">
          {bars.map((b) => (
            <div
              key={b.key}
              className={AGING_COLOR[b.key]}
              style={{ width: `${b.pct}%` }}
              title={`${b.label}: ${formatClp(b.amount)}`}
            />
          ))}
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-5">
        {bars.map((b) => (
          <div key={b.key} className="flex flex-col">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
              {b.label}
            </dt>
            <dd className="font-semibold tabular-nums text-neutral-dark">{formatClp(b.amount)}</dd>
          </div>
        ))}
      </dl>
    </QavanteCard>
  );
}

/* ── Resumen honesto ──────────────────────────────────────────────────────────
 * Modo urgencia: total + vencido + % vencido. Modo concentración: total + una nota
 * honesta de que los vencimientos aún no llegan (no un "Vencido $0" engañoso). */
export interface ResumenCobranzaProps {
  total: number;
  overdue: number;
  overduePct: number;
  /** `concentracion` = sin vencimientos todavía. */
  mode: "urgencia" | "concentracion";
  /** Monto ya marcado conciliado (en Clientes) que se descontó del total. */
  conciliado?: number;
}

export function ResumenCobranza({
  total,
  overdue,
  overduePct,
  mode,
  conciliado = 0,
}: ResumenCobranzaProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Stat
        label="Total por cobrar"
        value={<AmountCountUp value={total} />}
        sub={conciliado > 0 ? `menos ${formatClp(conciliado)} conciliado` : undefined}
      />
      {mode === "urgencia" ? (
        <>
          <Stat label="Vencido" value={<AmountCountUp value={overdue} />} tone="danger" />
          <Stat
            label="% vencido"
            value={`${overduePct.toLocaleString("es-CL", { maximumFractionDigits: 1 })}%`}
            tone="danger"
          />
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-surface-muted/40 p-4 sm:col-span-2">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-neutral-dark">
            Vencimientos: pendientes del SII
            <InfoHint label="Por qué no mostramos lo vencido">
              El SII todavía no entrega las fechas de vencimiento de tus facturas (XML del DTE), así
              que aún no podemos decir qué está vencido. Cuando lleguen, esta pantalla prioriza por
              mora automáticamente.
            </InfoHint>
          </p>
          <p className="mt-1 text-[12px] text-neutral-mid">
            Por ahora priorizamos tu cobranza por tamaño, no por mora.
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "danger";
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-extrabold tabular-nums",
          tone === "danger" ? "text-danger-500" : "text-neutral-dark",
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-success-700">{sub}</p>}
    </div>
  );
}

/* ── Fila de deudor con acciones + expansión a sus facturas ────────────────────
 * El contenedor maneja el estado (abierto, copiado, gestionado, fetch de facturas)
 * y pasa todo por props; esta fila solo pinta. */
export interface DeudorRowProps {
  name: string;
  rut: string;
  total: number;
  overdue: number;
  /** Qué parte del total por cobrar es este cliente (%). */
  pct: number;
  /** Fecha ISO en que se marcó gestionado, o null. */
  gestionado: string | null;
  /** Acciones (copiar/WhatsApp/mail/gestionado) para este deudor. */
  onCopiar: () => void;
  copiado: boolean;
  waHref: string;
  mailtoHref: string;
  onToggleGestionado: () => void;
  gestionadoPending?: boolean;
  /** Expansión a facturas (Libro de Ventas). */
  isOpen: boolean;
  onToggleOpen: () => void;
  docs: RcvDoc[];
  invoicesLoading: boolean;
  invoicesError: boolean;
  siiEnabled: boolean;
}

export function DeudorRow(props: DeudorRowProps) {
  const {
    name,
    rut,
    total,
    overdue,
    pct,
    gestionado,
    onCopiar,
    copiado,
    waHref,
    mailtoHref,
    onToggleGestionado,
    gestionadoPending,
    isOpen,
    onToggleOpen,
    docs,
    invoicesLoading,
    invoicesError,
    siiEnabled,
  } = props;

  return (
    <li className={cn("py-1", gestionado != null && "opacity-70")}>
      <div className="flex flex-col gap-2 py-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={onToggleOpen}
          className="-mx-2 flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-neutral-mid transition-transform",
              isOpen && "rotate-180",
            )}
            aria-hidden="true"
          />
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate font-medium text-neutral-dark">{name}</span>
              {gestionado != null && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-500/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-success-700">
                  <CircleCheck className="size-3" aria-hidden="true" />
                  Gestionado {formatDateLike(gestionado)}
                </span>
              )}
            </span>
            <span className="block text-xs text-neutral-mid">{formatRut(rut)}</span>
          </span>
        </button>

        <div className="shrink-0 pl-6 text-left tabular-nums sm:pl-0 sm:text-right">
          <p className="font-semibold text-neutral-dark">{formatClp(total)}</p>
          {pct >= 10 && (
            <p className="text-xs text-neutral-mid">
              {pct.toLocaleString("es-CL", { maximumFractionDigits: 1 })}% del total
            </p>
          )}
          {overdue > 0 && (
            <p className="text-xs font-medium text-danger-500">{formatClp(overdue)} vencido</p>
          )}
        </div>
      </div>

      <div className="pl-6">
        <CobranzaAcciones
          size="sm"
          onCopiar={onCopiar}
          copiado={copiado}
          waHref={waHref}
          mailtoHref={mailtoHref}
          gestionado={gestionado}
          onToggleGestionado={onToggleGestionado}
          gestionadoPending={gestionadoPending}
        />
      </div>

      {isOpen && (
        <DebtorInvoicesPanel
          docs={docs}
          loading={invoicesLoading}
          error={invoicesError}
          siiEnabled={siiEnabled}
        />
      )}
    </li>
  );
}
