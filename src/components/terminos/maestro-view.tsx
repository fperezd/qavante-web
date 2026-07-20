"use client";

import * as React from "react";
import { Check, ChevronDown, RotateCcw } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { InfoHint } from "@/components/ui/info-hint";
import { formatClp } from "@/lib/formatters/clp";
import { formatRut } from "@/lib/formatters/rut";
import { formatDateLike } from "@/lib/formatters/date";
import { tipoDocMeta } from "@/components/sii/tipo-doc";
import { cn } from "@/lib/utils";
import type { ContraparteMaestro, EstadoDoc, MaestroKind } from "./terminos-pago";

/* MaestroContrapartes — vista del maestro (clientes/proveedores/honorarios). Tabla de
   contrapartes con su término de pago EDITABLE; el vencimiento se deriva (emisión +
   término). Presentacional: el contenedor pasa los datos ya construidos y los handlers
   de edición (persisten en prefs). Cada contraparte expande a sus documentos. */

const ESTADO_META: Record<EstadoDoc, { label: string; cls: string }> = {
  vencido: { label: "Vencido", cls: "bg-danger-500/10 text-danger-500" },
  por_vencer: { label: "Por vencer", cls: "bg-warning-500/15 text-warning-700" },
  vigente: { label: "Vigente", cls: "bg-success-500/10 text-success-700" },
  sin_fecha: { label: "Sin fecha", cls: "bg-neutral-light/40 text-neutral-mid" },
};

export interface MaestroContrapartesProps {
  kind: MaestroKind;
  /** "clientes" | "proveedores" | "profesionales". */
  contrapartePlural: string;
  cps: ContraparteMaestro[];
  totals: {
    total: number;
    vencido: number;
    porVencer: number;
    pagado: number;
    contrapartes: number;
    docs: number;
  };
  defaultTerm: number;
  onSetTerm: (rut: string, days: number) => void;
  onResetTerm: (rut: string) => void;
  onSetDefault: (days: number) => void;
  /** Marca/desmarca un documento como pagado (persiste en prefs). */
  onTogglePagado: (rut: string, folio: number | string | null) => void;
  pending?: boolean;
  /** Etiqueta del rango consultado, ej. "ene–jul 2026". */
  periodosLabel?: string;
  /** Título del encabezado. Default: "Maestro de {plural}". */
  titulo?: string;
  /** Bajada bajo el encabezado (ej. "Todos los del año, no solo lo pendiente"). */
  subtitulo?: React.ReactNode;
}

export function MaestroContrapartes({
  contrapartePlural,
  cps,
  totals,
  defaultTerm,
  onSetTerm,
  onResetTerm,
  onSetDefault,
  onTogglePagado,
  pending,
  periodosLabel,
  titulo,
  subtitulo,
}: MaestroContrapartesProps) {
  const [openRut, setOpenRut] = React.useState<string | null>(null);

  return (
    <QavanteCard
      variant="bordered"
      header={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-medium">
            {titulo ?? `Maestro de ${contrapartePlural}`}
            <InfoHint label="Cómo se calcula el vencimiento">
              El SII no entrega las fechas de vencimiento, así que las derivamos:{" "}
              <b>vencimiento = emisión + término de pago</b>. Ajusta el término por contraparte para
              tener control. El vencido se calcula sobre lo facturado{periodosLabel ? ` (${periodosLabel})` : ""};
              marca <b>“conciliado”</b> los documentos ya cruzados con el banco/pago y salen del vencido.
            </InfoHint>
          </span>
          <DefaultTermControl defaultTerm={defaultTerm} onSetDefault={onSetDefault} pending={pending} />
        </div>
      }
    >
      {subtitulo && <p className="mb-3 text-[12.5px] text-neutral-mid">{subtitulo}</p>}

      {/* Resumen. */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Resumen
          label="Facturado"
          value={formatClp(totals.total)}
          sub={totals.pagado > 0 ? `${formatClp(totals.pagado)} conciliado` : undefined}
        />
        <Resumen label="Vencido" value={formatClp(totals.vencido)} tone="danger" />
        <Resumen label="Por vencer" value={formatClp(totals.porVencer)} tone="warn" />
        <Resumen label={contrapartePlural} value={`${totals.contrapartes}`} sub={`${totals.docs} docs`} />
      </div>

      {cps.length === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-mid">
          Sin documentos en el período.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border-strong text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
                <th className="py-2 pr-3 font-semibold">Contraparte</th>
                <th className="py-2 pr-3 text-right font-semibold">Docs</th>
                <th className="py-2 pr-3 text-right font-semibold">Total</th>
                <th className="py-2 pr-3 text-center font-semibold">Término</th>
                <th className="py-2 pr-3 text-right font-semibold">Vencido</th>
                <th className="py-2 text-right font-semibold">Próximo</th>
              </tr>
            </thead>
            <tbody>
              {cps.map((cp) => (
                <ContraparteRow
                  key={cp.rut}
                  cp={cp}
                  isOpen={openRut === cp.rut}
                  onToggle={() => setOpenRut(openRut === cp.rut ? null : cp.rut)}
                  onSetTerm={onSetTerm}
                  onResetTerm={onResetTerm}
                  onTogglePagado={onTogglePagado}
                  pending={pending}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </QavanteCard>
  );
}

function Resumen({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "danger" | "warn";
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted/30 p-2.5">
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-neutral-mid">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-[15px] font-bold tabular-nums",
          tone === "danger" ? "text-danger-500" : tone === "warn" ? "text-warning-700" : "text-neutral-dark",
        )}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-neutral-mid">{sub}</p>}
    </div>
  );
}

function DefaultTermControl({
  defaultTerm,
  onSetDefault,
  pending,
}: {
  defaultTerm: number;
  onSetDefault: (days: number) => void;
  pending?: boolean;
}) {
  return (
    <label className="flex items-center gap-1.5 text-[12px] text-neutral-mid">
      Término por defecto:
      <TermInput value={defaultTerm} onCommit={onSetDefault} disabled={pending} ariaLabel="Término de pago por defecto (días)" />
      <span>días</span>
    </label>
  );
}

function ContraparteRow({
  cp,
  isOpen,
  onToggle,
  onSetTerm,
  onResetTerm,
  onTogglePagado,
  pending,
}: {
  cp: ContraparteMaestro;
  isOpen: boolean;
  onToggle: () => void;
  onSetTerm: (rut: string, days: number) => void;
  onResetTerm: (rut: string) => void;
  onTogglePagado: (rut: string, folio: number | string | null) => void;
  pending?: boolean;
}) {
  return (
    <>
      <tr className="border-b border-border/60 transition-colors hover:bg-surface-muted">
        <td className="py-2 pr-3">
          <button
            type="button"
            aria-expanded={isOpen}
            onClick={onToggle}
            className="-mx-1 flex items-center gap-1.5 rounded px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 text-neutral-mid transition-transform", isOpen && "rotate-180")}
              aria-hidden="true"
            />
            <span className="min-w-0">
              <span className="block max-w-[220px] truncate font-medium text-neutral-dark">{cp.name}</span>
              <span className="block text-xs text-neutral-mid">{formatRut(cp.rut)}</span>
            </span>
          </button>
        </td>
        <td className="py-2 pr-3 text-right tabular-nums text-neutral-mid">{cp.docCount}</td>
        <td className="py-2 pr-3 text-right tabular-nums font-medium text-neutral-dark">{formatClp(cp.total)}</td>
        <td className="py-2 pr-3">
          <div className="flex items-center justify-center gap-1">
            <TermInput
              value={cp.termino}
              onCommit={(d) => onSetTerm(cp.rut, d)}
              disabled={pending}
              ariaLabel={`Término de pago de ${cp.name} (días)`}
              highlighted={cp.terminoCustom}
            />
            {cp.terminoCustom && (
              <button
                type="button"
                onClick={() => onResetTerm(cp.rut)}
                disabled={pending}
                aria-label="Volver al término por defecto"
                title="Volver al término por defecto"
                className="rounded p-0.5 text-neutral-mid hover:text-brand-primary disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </td>
        <td className="py-2 pr-3 text-right tabular-nums">
          {cp.vencido > 0 ? (
            <span className="font-semibold text-danger-500">{formatClp(cp.vencido)}</span>
          ) : (
            <span className="text-neutral-mid">—</span>
          )}
        </td>
        <td className="py-2 text-right tabular-nums text-neutral-mid">
          {cp.proximoVencimiento ? formatDateLike(cp.proximoVencimiento.toISOString().slice(0, 10)) : "—"}
        </td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={6} className="bg-surface-muted/30 px-3 py-2">
            <DocDetail cp={cp} onTogglePagado={onTogglePagado} pending={pending} />
          </td>
        </tr>
      )}
    </>
  );
}

function DocDetail({
  cp,
  onTogglePagado,
  pending,
}: {
  cp: ContraparteMaestro;
  onTogglePagado: (rut: string, folio: number | string | null) => void;
  pending?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-[12.5px]">
        <thead>
          <tr className="border-b border-border text-left text-[10.5px] font-semibold uppercase tracking-wider text-neutral-mid">
            <th className="py-1 pr-3 font-semibold">Folio</th>
            <th className="py-1 pr-3 font-semibold">Tipo</th>
            <th className="py-1 pr-3 font-semibold">Emisión</th>
            <th className="py-1 pr-3 font-semibold">Vence</th>
            <th className="py-1 pr-3 font-semibold">Estado</th>
            <th className="py-1 pr-3 text-right font-semibold">Monto</th>
            <th className="py-1 text-right font-semibold">Conciliación</th>
          </tr>
        </thead>
        <tbody>
          {cp.docs.map((d, i) => {
            const meta = ESTADO_META[d.estado];
            return (
              <tr
                key={`${d.folio ?? "x"}-${i}`}
                className={cn(
                  "border-b border-border/50 last:border-b-0",
                  d.pagado && "opacity-60",
                  d.esNotaCredito && d.refFolio != null && "bg-warning-500/[.04]",
                )}
              >
                <td className="py-1 pr-3 tabular-nums text-neutral-dark">
                  {d.esNotaCredito && d.refFolio != null ? (
                    <span className="text-neutral-mid">↳ {d.folio ?? "—"}</span>
                  ) : (
                    (d.folio ?? "—")
                  )}
                </td>
                <td className="py-1 pr-3">
                  <span
                    title={tipoDocMeta(d.tipoDoc).label}
                    className={cn(
                      "inline-block rounded px-1.5 py-0.5 text-[10px] font-bold",
                      d.esNotaCredito
                        ? "bg-warning-500/15 text-warning-700"
                        : "bg-neutral-light/40 text-neutral-mid",
                    )}
                  >
                    {tipoDocMeta(d.tipoDoc).abbr}
                  </span>
                </td>
                <td className="py-1 pr-3 text-neutral-mid">{d.fechaEmision ? formatDateLike(d.fecha) : d.fecha || "—"}</td>
                <td className="py-1 pr-3 text-neutral-mid">
                  {d.vencimiento ? formatDateLike(d.vencimiento.toISOString().slice(0, 10)) : "—"}
                </td>
                <td className="py-1 pr-3">
                  {d.pagado ? (
                    <span className="inline-block rounded-full bg-success-500/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-success-700">
                      Conciliado
                    </span>
                  ) : d.esNotaCredito ? (
                    <span className="text-[10.5px] font-semibold text-neutral-mid">
                      {d.refFolio != null ? `anula N° ${d.refFolio}` : "Crédito"}
                    </span>
                  ) : d.anulacion === "anulada" ? (
                    <span className="inline-block rounded-full bg-danger-500/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-danger-500">
                      Anulada
                    </span>
                  ) : d.anulacion === "parcial" ? (
                    <span className="inline-block rounded-full bg-warning-500/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-warning-700">
                      Parcial
                    </span>
                  ) : (
                    <span className={cn("inline-block rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold", meta.cls)}>
                      {meta.label}
                      {d.estado === "vencido" && d.diasParaVencer != null && ` ${Math.abs(d.diasParaVencer)}d`}
                    </span>
                  )}
                </td>
                <td
                  className={cn(
                    "py-1 pr-3 text-right tabular-nums",
                    d.esNotaCredito ? "text-warning-700" : "text-neutral-dark",
                    (d.pagado || d.anulacion === "anulada") && "line-through",
                  )}
                >
                  {formatClp(d.monto)}
                </td>
                <td className="py-1 text-right">
                  <button
                    type="button"
                    onClick={() => onTogglePagado(cp.rut, d.folio)}
                    disabled={pending}
                    aria-pressed={d.pagado}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
                      d.pagado
                        ? "border-success-500/40 bg-success-500/10 text-success-700"
                        : "border-border bg-surface text-neutral-mid hover:border-brand-primary hover:text-brand-primary",
                    )}
                  >
                    {d.pagado ? (
                      <>
                        <Check className="size-3" aria-hidden="true" />
                        Conciliado
                      </>
                    ) : (
                      "Marcar conciliado"
                    )}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* Input de término: número controlado localmente; confirma con Enter o al perder foco
   (no persiste en cada tecla). Vuelve al valor externo si se cancela con Escape. */
function TermInput({
  value,
  onCommit,
  disabled,
  ariaLabel,
  highlighted,
}: {
  value: number;
  onCommit: (days: number) => void;
  disabled?: boolean;
  ariaLabel: string;
  highlighted?: boolean;
}) {
  const [draft, setDraft] = React.useState(String(value));
  // Sincroniza si el valor externo cambia (ej. reset).
  React.useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const n = Math.round(Number(draft));
    if (Number.isFinite(n) && n >= 0 && n !== value) onCommit(n);
    else setDraft(String(value));
  };

  return (
    <input
      type="number"
      min={0}
      inputMode="numeric"
      value={draft}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        } else if (e.key === "Escape") {
          setDraft(String(value));
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={cn(
        "w-14 rounded-md border px-1.5 py-0.5 text-center text-[12.5px] tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-50",
        highlighted ? "border-brand-primary/50 bg-brand-primary/[.06] font-semibold text-brand-primary" : "border-border bg-surface text-neutral-dark",
      )}
    />
  );
}
