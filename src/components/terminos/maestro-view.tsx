"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, RotateCcw } from "lucide-react";
import { QavanteCard, SortHeader } from "@/components/qavante";
import { useTableSort, type SortColumn } from "@/lib/hooks/use-table-sort";
import { InfoHint } from "@/components/ui/info-hint";
import { formatClp } from "@/lib/formatters/clp";
import { formatRut } from "@/lib/formatters/rut";
import { formatDateLike } from "@/lib/formatters/date";
import { tipoDocMeta } from "@/components/sii/tipo-doc";
import { ReclamadaBadge } from "@/components/sii/reclamada-badge";
import { DteActions } from "@/components/sii/dte-actions";
import { pdfUrlDeDoc } from "./maestro-pdf-url";
import { DESTINO_CONCILIACION, nombreDestino } from "./conciliacion-destino";
import { cn } from "@/lib/utils";
import type { ContraparteMaestro, EstadoDoc, MaestroKind } from "./terminos-pago";

/* Columnas ordenables del maestro (regla de producto: grilla ordenable). El
   "Término" es un input editable → no se ordena. Por defecto: saldo desc (quién
   debe/nos deben más); "Próximo" (fecha) arranca más nueva primero. */
const SORT_COLUMNS: SortColumn<ContraparteMaestro>[] = [
  { key: "contraparte", kind: "text", get: (c) => c.name },
  { key: "docs", kind: "number", get: (c) => c.docCount },
  { key: "saldo", kind: "number", get: (c) => c.total - c.pagado },
  { key: "vencido", kind: "number", get: (c) => c.vencido },
  { key: "proximo", kind: "date", get: (c) => c.proximoVencimiento?.toISOString() ?? null },
];

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
    declaradoSinEvidencia: number;
    docsDeclarados: number;
    contrapartes: number;
    docs: number;
  };
  defaultTerm: number;
  onSetTerm: (rut: string, days: number) => void;
  onResetTerm: (rut: string) => void;
  onSetDefault: (days: number) => void;
  pending?: boolean;
  /** Etiqueta del rango consultado, ej. "ene–jul 2026". */
  periodosLabel?: string;
  /** Título del encabezado. Default: "Maestro de {plural}". */
  titulo?: string;
  /** Bajada bajo el encabezado (ej. "Todos los del año, no solo lo pendiente"). */
  subtitulo?: React.ReactNode;
}

export function MaestroContrapartes({
  kind,
  contrapartePlural,
  cps,
  totals,
  defaultTerm,
  onSetTerm,
  onResetTerm,
  onSetDefault,
  pending,
  periodosLabel,
  titulo,
  subtitulo,
}: MaestroContrapartesProps) {
  const [openRut, setOpenRut] = React.useState<string | null>(null);
  const saldoLabel = kind === "ventas" ? "Por cobrar" : "Por pagar";
  /* Orden de la grilla (por defecto saldo desc; toda columna —salvo Término— ordenable). */
  const sort = useTableSort(SORT_COLUMNS, "saldo");
  const cpsSorted = sort.sorted(cps);

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
              tener control. Acá sólo queda lo que falta conciliar
              {periodosLabel ? ` (${periodosLabel})` : ""}, neto de notas de crédito: cuando un
              documento se cruza contra un movimiento bancario en <b>{nombreDestino(kind)}</b>, sale
              de esta lista y baja tu {saldoLabel.toLowerCase()}.
            </InfoHint>
          </span>
          <DefaultTermControl
            defaultTerm={defaultTerm}
            onSetDefault={onSetDefault}
            pending={pending}
          />
        </div>
      }
    >
      {subtitulo && <p className="mb-3 text-[12.5px] text-neutral-mid">{subtitulo}</p>}

      {/* Resumen. */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Resumen
          label={saldoLabel}
          value={formatClp(totals.total - totals.pagado)}
          sub={`${totals.docs} documentos sin conciliar de ${totals.contrapartes} ${contrapartePlural}`}
        />
        <Resumen label="Vencido" value={formatClp(totals.vencido)} tone="danger" />
        <Resumen label="Por vencer" value={formatClp(totals.porVencer)} tone="warn" />
        <Resumen
          label="Declarado a mano"
          value={formatClp(totals.declaradoSinEvidencia)}
          sub={`${totals.docsDeclarados} documentos que marcaste pagados y siguen sin movimiento bancario`}
          tone={totals.docsDeclarados > 0 ? "warn" : undefined}
        />
      </div>

      {cps.length === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-mid">Sin documentos en el período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border-strong text-left">
                <th className="py-2 pr-3">
                  <SortHeader
                    label="Contraparte"
                    active={sort.sortKey === "contraparte"}
                    dir={sort.sortDir}
                    onClick={() => sort.toggle("contraparte")}
                  />
                </th>
                <th className="py-2 pr-3">
                  <div className="flex justify-end">
                    <SortHeader
                      label="Docs"
                      align="right"
                      active={sort.sortKey === "docs"}
                      dir={sort.sortDir}
                      onClick={() => sort.toggle("docs")}
                    />
                  </div>
                </th>
                <th className="py-2 pr-3">
                  <div className="flex justify-end">
                    <SortHeader
                      label={saldoLabel}
                      align="right"
                      active={sort.sortKey === "saldo"}
                      dir={sort.sortDir}
                      onClick={() => sort.toggle("saldo")}
                    />
                  </div>
                </th>
                <th className="py-2 pr-3 text-center text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
                  Término
                </th>
                <th className="py-2 pr-3">
                  <div className="flex justify-end">
                    <SortHeader
                      label="Vencido"
                      align="right"
                      active={sort.sortKey === "vencido"}
                      dir={sort.sortDir}
                      onClick={() => sort.toggle("vencido")}
                    />
                  </div>
                </th>
                <th className="py-2">
                  <div className="flex justify-end">
                    <SortHeader
                      label="Próximo"
                      align="right"
                      active={sort.sortKey === "proximo"}
                      dir={sort.sortDir}
                      onClick={() => sort.toggle("proximo")}
                    />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {cpsSorted.map((cp) => (
                <ContraparteRow
                  kind={kind}
                  key={cp.rut}
                  cp={cp}
                  isOpen={openRut === cp.rut}
                  onToggle={() => setOpenRut(openRut === cp.rut ? null : cp.rut)}
                  onSetTerm={onSetTerm}
                  onResetTerm={onResetTerm}
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
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-neutral-mid">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-[15px] font-bold tabular-nums",
          tone === "danger"
            ? "text-danger-500"
            : tone === "warn"
              ? "text-warning-700"
              : "text-neutral-dark",
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
      <TermInput
        value={defaultTerm}
        onCommit={onSetDefault}
        disabled={pending}
        ariaLabel="Término de pago por defecto (días)"
      />
      <span>días</span>
    </label>
  );
}

function ContraparteRow({
  cp,
  kind,
  isOpen,
  onToggle,
  onSetTerm,
  onResetTerm,
  pending,
}: {
  cp: ContraparteMaestro;
  kind: MaestroKind;
  isOpen: boolean;
  onToggle: () => void;
  onSetTerm: (rut: string, days: number) => void;
  onResetTerm: (rut: string) => void;
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
              className={cn(
                "h-4 w-4 shrink-0 text-neutral-mid transition-transform",
                isOpen && "rotate-180",
              )}
              aria-hidden="true"
            />
            <span className="min-w-0">
              <span className="block max-w-[220px] truncate font-medium text-neutral-dark">
                {cp.name}
              </span>
              <span className="block text-xs text-neutral-mid">{formatRut(cp.rut)}</span>
            </span>
          </button>
        </td>
        <td className="py-2 pr-3 text-right tabular-nums text-neutral-mid">{cp.docCount}</td>
        <td className="py-2 pr-3 text-right tabular-nums font-medium text-neutral-dark">
          {formatClp(cp.total - cp.pagado)}
        </td>
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
            <span className="text-neutral-mid">Sin información</span>
          )}
        </td>
        <td className="py-2 text-right tabular-nums text-neutral-mid">
          {cp.proximoVencimiento
            ? formatDateLike(cp.proximoVencimiento.toISOString().slice(0, 10))
            : "Sin información"}
        </td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={6} className="bg-surface-muted/30 px-3 py-2">
            <DocDetail cp={cp} kind={kind} />
          </td>
        </tr>
      )}
    </>
  );
}

function DocDetail({ cp, kind }: { cp: ContraparteMaestro; kind: MaestroKind }) {
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
            <th className="py-1 pr-3 text-right font-semibold">DTE</th>
            <th className="py-1 text-right font-semibold">Conciliar</th>
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
                  d.esNotaCredito && d.refFolio != null && "bg-warning-500/[.04]",
                )}
              >
                <td className="py-1 pr-3 tabular-nums text-neutral-dark">
                  <span className="inline-flex items-center gap-1.5">
                    {d.esNotaCredito && d.refFolio != null ? (
                      <span className="text-neutral-mid">↳ {d.folio ?? "Sin información"}</span>
                    ) : (
                      (d.folio ?? "Sin información")
                    )}
                    {d.reclamado && <ReclamadaBadge />}
                  </span>
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
                <td className="py-1 pr-3 text-neutral-mid">
                  {d.fechaEmision ? formatDateLike(d.fecha) : d.fecha || "Sin información"}
                </td>
                <td className="py-1 pr-3 text-neutral-mid">
                  {d.vencimiento
                    ? formatDateLike(d.vencimiento.toISOString().slice(0, 10))
                    : "Sin información"}
                </td>
                <td className="py-1 pr-3">
                  {d.conciliacion === "partial" ? (
                    <span className="inline-block rounded-full bg-brand-primary/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-brand-primary">
                      Pago parcial
                    </span>
                  ) : d.esNotaCredito ? (
                    <span className="text-[10.5px] font-semibold text-neutral-mid">
                      {d.associationStatus === "reference_effect_unknown"
                        ? "Efecto por verificar"
                        : d.associationStatus === "possible_association"
                          ? "Asociación posible"
                          : d.associationStatus === "ambiguous"
                            ? "Asociación ambigua"
                            : "Sin asociar"}
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
                    <span
                      className={cn(
                        "inline-block rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold",
                        meta.cls,
                      )}
                    >
                      {meta.label}
                      {d.estado === "vencido" &&
                        d.diasParaVencer != null &&
                        ` ${Math.abs(d.diasParaVencer)}d`}
                    </span>
                  )}
                </td>
                <td
                  className={cn(
                    "py-1 pr-3 text-right tabular-nums",
                    d.esNotaCredito ? "text-warning-700" : "text-neutral-dark",
                    d.anulacion === "anulada" && "line-through",
                  )}
                >
                  {formatClp(d.monto)}
                </td>
                <td className="py-1 pr-3 text-right">
                  <DteActions url={pdfUrlDeDoc(kind, cp.rut, d)} label={`folio ${d.folio ?? ""}`} />
                </td>
                <td className="py-1 text-right align-top">
                  {/* Antes había acá un botón "Marcar conciliado" que sólo escribía una marca en
                      las preferencias del usuario (ni conciliaba, ni la veían los demás). El
                      dueño lo rechazó, y también rechazó reemplazarlo por un "declarar pagado
                      sin evidencia". Lo que queda es el camino a donde se concilia de verdad:
                      el documento se cruza contra un movimiento bancario. */}
                  <Link
                    href={DESTINO_CONCILIACION[kind]}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] font-semibold text-neutral-mid transition-colors hover:border-brand-primary hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                    aria-label={`Conciliar el folio ${d.folio ?? ""} contra un movimiento bancario en ${nombreDestino(kind)}`}
                  >
                    Conciliar en {nombreDestino(kind)}
                    <ArrowUpRight className="size-3" aria-hidden="true" />
                  </Link>
                  {d.declaradoPagadoEl && (
                    <p className="mt-0.5 text-[10.5px] text-warning-700">
                      Lo marcaste pagado el {formatDateLike(d.declaradoPagadoEl)}, sin movimiento
                      bancario asociado
                    </p>
                  )}
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
        highlighted
          ? "border-brand-primary/50 bg-brand-primary/[.06] font-semibold text-brand-primary"
          : "border-border bg-surface text-neutral-dark",
      )}
    />
  );
}
