"use client";

import * as React from "react";
import { TrendingUp, X } from "lucide-react";
import { QavanteBadge, QavanteStatTile } from "@/components/qavante";
import { formatClp } from "@/lib/formatters/clp";
import { formatPeriodLabel } from "@/components/sii/sii-period-form-schema";
import { normalizeRut } from "@/lib/validators/rut";
import { tipoDocMeta } from "@/components/sii/tipo-doc";
import {
  aggregateCustomer360Counterparties,
  concentracionPct,
  customer360DocumentDate,
  customer360DocumentKind,
  customer360Series,
  customer360SignedAmount,
  sinMesEnCurso,
  validateCustomer360Documents,
  type Customer360Counterparty,
  type Customer360Scope,
  type ValidCustomer360Document,
} from "./contraparte-360-model";
import { formatPct } from "@/lib/formatters/pct";
import { useCustomer360Source, type Customer360PeriodCoverage } from "./use-customer-360-source";

/* Contención del 360 sobre una única ventana RCV de 12 meses. La misma población alimenta todas las
   cifras visibles; los comparativos históricos quedan fuera hasta que exista el productor canónico.
   Config-driven: la misma vista sirve para clientes y proveedores. "Días de pago real" no se calcula
   hasta contar con el cruce documental y bancario. Sin `export const runtime` (regla 4). */

/** "2026-07" → "07-2026" (mes-año, no año-mes). Deja el input si no parsea. */
function mesAnioNum(periodo: string): string {
  const m = periodo.match(/^(\d{4})-(\d{2})/);
  return m ? `${m[2]}-${m[1]}` : periodo;
}

export interface Config360 {
  kind: "ventas" | "compras";
  /** "cliente" / "proveedor" */
  contraparte: string;
  /** "clientes" / "proveedores" */
  contrapartes: string;
  /** "Facturación" / "Compras" (sustantivo del flujo) */
  flujo: string;
  /** "te factura" no; usamos "le vendes a" / "le compras a" — frase del verbo */
  verbo: string;
  /** "de tus ventas" / "de tus compras" */
  delTotal: string;
}

export function Contraparte360View({ config }: { config: Config360 }) {
  const source = useCustomer360Source(config.kind);
  const validation = React.useMemo(
    () =>
      validateCustomer360Documents(
        source.focusDocs,
        source.canAggregatePeriods,
        source.invalidDateDocuments,
        source.ambiguousDocumentIdentities,
      ),
    [
      source.focusDocs,
      source.canAggregatePeriods,
      source.invalidDateDocuments,
      source.ambiguousDocumentIdentities,
    ],
  );
  const agregados = React.useMemo(
    () => (validation.canAggregate ? aggregateCustomer360Counterparties(validation.docs) : []),
    [validation],
  );
  const totalGlobal = React.useMemo(
    () => agregados.reduce((total, counterparty) => total + counterparty.total, 0),
    [agregados],
  );
  const observedPeriods = React.useMemo(
    () =>
      source.coverage
        .filter((month) => month.state === "observed" || month.state === "observed_zero")
        .map((month) => month.period),
    [source.coverage],
  );

  const [rut, setRut] = React.useState<string | null>(null);
  // Default: la contraparte que más pesa (una vez que llegan los datos).
  const rutSel = rut ?? agregados[0]?.rut ?? null;
  const sel = agregados.find((c) => c.rut === rutSel) ?? null;

  if (!validation.canAggregate) {
    return (
      <div className="space-y-4">
        <ScopeSummary source={source} />
        <section className="rounded-xl border border-warning-500/40 bg-warning-500/[.06] p-6 text-sm text-neutral-dark">
          <h2 className="font-semibold">Aún no podemos calcular este 360 con seguridad</h2>
          <p className="mt-1 text-neutral-mid">
            No mostramos tarjeta, ranking ni concentración si no hay ningún mes válido, un monto
            válido o una identidad confiable. Así evitamos publicar ausencias como $0 o juntar
            contrapartes distintas.
          </p>
          <AbstainDetails coverage={source.coverage} reasons={validation.reasons} />
        </section>
      </div>
    );
  }
  if (agregados.length === 0) {
    return (
      <div className="space-y-4">
        <ScopeSummary source={source} />
        <section className="rounded-xl border border-border bg-surface p-6 text-sm text-neutral-mid">
          {emptyCoverageMessage(config.flujo, observedPeriods.length, source.isCoverageComplete)}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ScopeSummary source={source} />
      <Selector
        agregados={agregados}
        value={rutSel}
        onChange={setRut}
        config={config}
        totalGlobal={totalGlobal}
      />
      {sel && (
        <Detalle
          sel={sel}
          docs={validation.docs}
          scope={source.scope}
          totalGlobal={totalGlobal}
          config={config}
          observedPeriods={observedPeriods}
          isCoverageComplete={source.isCoverageComplete}
        />
      )}
    </div>
  );
}

/** El vacío parcial sólo habla de lo que respondió; nunca convierte los otros meses en ausencia. */
export function emptyCoverageMessage(
  flujo: string,
  observedMonths: number,
  isCoverageComplete: boolean,
): string {
  const lowerFlow = flujo.toLowerCase();
  if (isCoverageComplete) return `No observamos ${lowerFlow} en la ventana indicada.`;
  const noun = observedMonths === 1 ? "mes observado" : "meses observados";
  const missing = Math.max(0, 12 - observedMonths);
  return `No observamos ${lowerFlow} en ${observedMonths} ${noun}; ${missing} ${
    missing === 1 ? "mes sigue sin respuesta" : "meses siguen sin respuesta"
  }.`;
}

function ScopeSummary({ source }: { source: ReturnType<typeof useCustomer360Source> }) {
  const observed = source.coverage.filter(
    (month) => month.state === "observed" || month.state === "observed_zero",
  ).length;
  const observedZero = source.coverage.filter((month) => month.state === "observed_zero").length;
  const syncs = source.coverage
    .map((month) => month.lastSyncedAt)
    .filter((value): value is string => value != null)
    .sort();
  const lastSync = syncs.at(-1) ?? null;
  return (
    <section className="rounded-xl border border-border bg-surface px-4 py-3 text-xs text-neutral-mid">
      <p className="font-semibold text-neutral-dark">
        Ventana {formatPeriodLabel(source.scope.periodFrom)}–
        {formatPeriodLabel(source.scope.periodTo)} · hasta {source.scope.asOfDate} en Santiago
      </p>
      <p className="mt-1">
        Base bruta con IVA: NC restan, ND suman y reclamados se informan aparte. {observed}/12 meses
        respondieron{observedZero > 0 ? `; ${observedZero} sin documentos observados` : ""}.
      </p>
      <p className="mt-1">
        Cobertura observada desde respuestas mensuales; todavía no es un manifiesto de completitud.
        {lastSync ? ` Última carga informada: ${lastSync}.` : " Sin hora de carga informada."}
      </p>
      {source.stalePeriods.length > 0 && (
        <p className="mt-1 font-medium text-warning-700">
          Datos desactualizados informados para: {source.stalePeriods.join(", ")}.
        </p>
      )}
    </section>
  );
}

function AbstainDetails({
  coverage,
  reasons,
}: {
  coverage: Customer360PeriodCoverage[];
  reasons: ReturnType<typeof validateCustomer360Documents>["reasons"];
}) {
  const unavailable = coverage.filter(
    (month) => month.state === "loading" || month.state === "error" || month.state === "absent",
  );
  const labels: Record<(typeof reasons)[number], string> = {
    period_coverage_incomplete: "Aún no hay ningún mes mensual válido para analizar.",
    invalid_document_date: "Hay documentos sin una fecha de emisión válida.",
    invalid_document_amount: "Hay documentos con monto ausente o inválido.",
    unresolved_counterparty_identity: "Hay una contraparte sin identidad segura.",
    ambiguous_document_identity:
      "Hay documentos sin identidad fiscal completa o con la misma identidad y datos contradictorios.",
  };
  return (
    <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-neutral-mid">
      {reasons.map((reason) => (
        <li key={reason}>{labels[reason]}</li>
      ))}
      {unavailable.map((month) => (
        <li key={month.period}>
          {month.period}: {month.state === "loading" ? "cargando" : "no disponible"}
        </li>
      ))}
    </ul>
  );
}

/* ---------- Selector de contraparte ---------- */
function Selector({
  agregados,
  value,
  onChange,
  config,
  totalGlobal,
}: {
  agregados: Customer360Counterparty[];
  value: string | null;
  onChange: (rut: string) => void;
  config: Config360;
  totalGlobal: number;
}) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const sel = agregados.find((c) => c.rut === value) ?? null;
  const q = query.trim().toLowerCase();
  const qRut = query.replace(/[.\-\s]/g, "").toLowerCase();
  const filtered = q
    ? agregados.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          // Solo matchea por RUT si el texto tiene dígitos/letras (evita que "." matchee todo).
          (qRut !== "" &&
            c.rut
              .replace(/[.\-\s]/g, "")
              .toLowerCase()
              .includes(qRut)),
      )
    : agregados;

  const elegir = (rut: string) => {
    onChange(rut);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="relative sm:max-w-md">
      <label htmlFor="cp360-buscar" className="text-sm font-medium text-neutral-dark">
        Busca un {config.contraparte} por nombre o RUT
      </label>
      {/* El input es SIEMPRE un buscador (empieza vacío); la selección actual va como placeholder
          → para cambiar de contraparte no hay que borrar texto a mano, solo escribir o elegir. */}
      <div className="relative mt-1">
        <input
          id="cp360-buscar"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="cp360-lista"
          autoComplete="off"
          value={query}
          placeholder={sel ? `${sel.name} · ${formatClp(sel.total)}` : "Nombre o RUT…"}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            // Teclado: Enter elige el primer resultado (solo si estás buscando); Escape cierra.
            if (e.key === "Enter" && q && filtered.length > 0) {
              e.preventDefault();
              elegir(filtered[0]!.rut);
            } else if (e.key === "Escape") {
              setOpen(false);
              e.currentTarget.blur();
            }
          }}
          onBlur={() =>
            window.setTimeout(() => {
              setOpen(false);
              setQuery("");
            }, 150)
          }
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 pr-9 text-sm font-medium text-neutral-dark placeholder:font-normal placeholder:text-neutral-mid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
        />
        {query && (
          <button
            type="button"
            aria-label="Borrar búsqueda"
            onMouseDown={(e) => {
              e.preventDefault();
              setQuery("");
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-mid hover:text-neutral-dark"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      {open && (
        <ul
          id="cp360-lista"
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          {filtered.map((c) => {
            const pct = concentracionPct(c.total, totalGlobal);
            return (
              <li key={c.rut} role="option" aria-selected={c.rut === value}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    elegir(c.rut);
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm hover:bg-brand-primary-50"
                >
                  <span className="min-w-0 truncate text-neutral-dark">{c.name}</span>
                  <span className="shrink-0 tabular-nums text-neutral-mid">
                    {formatClp(c.total)}
                    {pct != null ? ` (${formatPct(pct)})` : ""}
                  </span>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-neutral-mid">Sin resultados para “{query}”.</li>
          )}
        </ul>
      )}
    </div>
  );
}

/* ---------- Detalle 360 de la contraparte seleccionada ---------- */
function Detalle({
  sel,
  docs,
  scope,
  totalGlobal,
  config,
  observedPeriods,
  isCoverageComplete,
}: {
  sel: Customer360Counterparty;
  docs: ValidCustomer360Document[];
  scope: Customer360Scope;
  totalGlobal: number;
  config: Config360;
  observedPeriods: string[];
  isCoverageComplete: boolean;
}) {
  const serie12 = React.useMemo(
    () => customer360Series(docs, sel.rut, scope, observedPeriods),
    [docs, sel.rut, scope, observedPeriods],
  );
  const pct = concentracionPct(sel.total, totalGlobal);

  // Riesgo: mayor documento y meses desde la última actividad.
  const docsSel = docs.filter((d) => normalizeRut(d.rut) === sel.rut);
  const mayor = docsSel.reduce((mx, d) => Math.max(mx, customer360SignedAmount(d)), 0);
  const mesesSinActividad = periodDiff(sel.ultimoPeriodo, scope.periodTo);

  return (
    <>
      {/* Cabecera */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-lg font-bold text-neutral-dark">{sel.name}</h2>
        <p className="text-xs text-neutral-mid">
          RUT {sel.rut} · actividad observada desde {formatPeriodLabel(sel.primerPeriodo)}
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <QavanteStatTile
            label={`${config.flujo} (${observedPeriods.length} ${
              observedPeriods.length === 1 ? "mes observado" : "meses observados"
            })`}
            value={formatClp(sel.total)}
            tone="default"
          />
          <QavanteStatTile
            label={`% ${config.delTotal} observado`}
            value={pct != null ? formatPct(pct) : "Sin información"}
            tone={pct != null && pct >= 25 ? "danger" : "default"}
            hint={
              pct != null && pct >= 25
                ? "Concentración alta: dependes mucho de esta contraparte."
                : undefined
            }
          />
          <QavanteStatTile label="Documentos" value={String(sel.docs)} tone="default" />
        </div>
        <p className="mt-3 text-xs text-neutral-mid">
          Documentos positivos {formatClp(sel.breakdown.positiveDocumentsGross)} · ND +
          {formatClp(sel.breakdown.debitNotesGross)} · NC −
          {formatClp(sel.breakdown.creditNotesGross)} · reclamados excluidos{" "}
          {formatClp(sel.breakdown.reclaimedGross)} ({sel.breakdown.reclaimedCount})
        </p>
      </section>

      {/* Venta/compra en el tiempo */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 text-sm font-bold text-neutral-dark">
          <TrendingUp className="h-4 w-4 text-brand-primary" aria-hidden="true" />
          {config.flujo} por mes observado ({observedPeriods.length})
        </div>
        <Barras serie={serie12} />
        <p className="mt-3 border-t border-dashed border-border pt-3 text-xs text-neutral-mid">
          Esta serie usa sólo los meses que respondieron; los meses sin respuesta no se muestran
          como $0. Los comparativos históricos no se muestran hasta contar con una fuente canónica
          de períodos equivalentes.
        </p>
      </section>

      {/* Recuperación: mes en curso vs. el mejor mes → cuánto hay para recuperar */}
      {isCoverageComplete && <Recuperacion serie={serie12} config={config} />}

      {/* Riesgo + días de pago */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <QavanteStatTile
          label={isCoverageComplete ? "Documento más grande" : "Documento observado más grande"}
          value={formatClp(mayor)}
          tone="default"
          hint={
            isCoverageComplete
              ? "La mayor factura del período con esta contraparte."
              : "El mayor documento de los meses observados para esta contraparte."
          }
        />
        <QavanteStatTile
          label={isCoverageComplete ? "Última actividad" : "Última actividad observada"}
          value={
            mesesSinActividad <= 0
              ? "Este mes"
              : `hace ${mesesSinActividad} ${mesesSinActividad === 1 ? "mes" : "meses"}`
          }
          tone={isCoverageComplete && mesesSinActividad >= 3 ? "danger" : "default"}
          hint={
            isCoverageComplete && mesesSinActividad >= 3
              ? "Sin actividad reciente, posible fuga."
              : undefined
          }
        />
      </div>

      <DiasDePago config={config} />

      {/* Últimas facturas */}
      <UltimosDocs docsSel={docsSel} />
    </>
  );
}

/* ---------- Sub-bloques ---------- */
/** Recuperación: último mes CERRADO vs. el MEJOR mes de la serie → cuánto hay para recuperar (ventas)
 *  o cuánto bajó la relación (compras). Responde "¿qué debería recuperar de este cliente?".
 *  El último punto de la serie es el mes EN CURSO (parcial: recién empieza) → NO se compara: daría
 *  una falsa "fuga" (día 1 = $0 vs su mejor mes). Se usa el último mes cerrado. */
function Recuperacion({
  serie,
  config,
}: {
  serie: { periodo: string; monto: number }[];
  config: Config360;
}) {
  // Excluye el mes en curso (el último de la serie) — parcial, no comparable con meses completos.
  const completos = sinMesEnCurso(serie);
  if (completos.length === 0) return null;
  const mejor = completos.reduce((mx, p) => (p.monto > mx.monto ? p : mx), completos[0]!);
  const actual = completos[completos.length - 1]!;
  if (mejor.monto <= 0) return null;
  const dif = mejor.monto - actual.monto; // + = por debajo de su mejor mes
  const pct = (actual.monto / mejor.monto) * 100 - 100; // negativo = bajo el pico
  const bajo = dif > 0;
  const esVentas = config.kind === "ventas";
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h3 className="text-sm font-bold text-neutral-dark">
        {esVentas
          ? "A recuperar (último mes cerrado vs. su mejor mes)"
          : "Último mes cerrado vs. su mayor mes"}
      </h3>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QavanteStatTile
          label="Mejor mes"
          value={formatClp(mejor.monto)}
          tone="default"
          hint={mesAnioNum(mejor.periodo)}
        />
        <QavanteStatTile
          label="Último mes cerrado"
          value={formatClp(actual.monto)}
          tone="default"
          hint={mesAnioNum(actual.periodo)}
        />
        <QavanteStatTile
          label={esVentas ? "A recuperar" : "Diferencia"}
          value={`${bajo ? "" : "+"}${formatClp(Math.abs(dif))}`}
          tone={bajo ? "danger" : "success"}
          hint={`${formatPct(pct, { signed: true })} vs. su mejor mes`}
        />
      </div>
    </section>
  );
}

function Barras({ serie }: { serie: { periodo: string; monto: number }[] }) {
  const [hover, setHover] = React.useState<number | null>(null);
  const max = Math.max(1, ...serie.map((p) => Math.abs(p.monto)));
  // Al pasar el mouse muestra el mes (YYYY-MM) + su valor; por defecto, el último mes.
  const activo = hover != null ? serie[hover] : serie[serie.length - 1];
  return (
    <div>
      <div className="mt-3 flex h-28 items-end gap-0.5" role="img" aria-label="Serie mensual">
        {serie.map((p, i) => {
          const h = Math.round((Math.abs(p.monto) / max) * 100);
          const neg = p.monto < 0;
          const on = i === hover;
          return (
            <div
              key={p.periodo}
              className="flex h-full flex-1 items-end"
              title={`${p.periodo}: ${formatClp(p.monto)}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div
                data-testid="serie-barra"
                className={`w-full rounded-t transition-colors ${
                  neg ? "bg-danger-500/50" : on ? "bg-brand-primary" : "bg-brand-primary/70"
                }`}
                style={{ height: `${Math.max(2, h)}%` }}
              />
            </div>
          );
        })}
      </div>
      {activo && (
        <p className="mt-2 text-sm font-semibold text-neutral-dark">
          <span className="tabular-nums">{mesAnioNum(activo.periodo)}</span> ·{" "}
          <span className="tabular-nums">{formatClp(activo.monto)}</span>
        </p>
      )}
    </div>
  );
}

function DiasDePago({ config }: { config: Config360 }) {
  const verbo = config.kind === "ventas" ? "en cobrar" : "en pagar";
  return (
    <section className="rounded-xl border border-warning-500/30 bg-warning-500/[.05] p-4 text-[13px]">
      <p className="font-semibold text-neutral-dark">Días promedio {verbo}: no disponible</p>
      <p className="mt-0.5 text-neutral-mid">
        El comportamiento de pago real (cuánto tarda de verdad, no el plazo pactado) necesita cruzar
        cada factura con su pago en el banco. Esa información todavía no está disponible.
      </p>
    </section>
  );
}

function UltimosDocs({ docsSel }: { docsSel: ValidCustomer360Document[] }) {
  const ultimos = [...docsSel]
    .sort((a, b) =>
      (customer360DocumentDate(b.fecha) ?? "").localeCompare(
        customer360DocumentDate(a.fecha) ?? "",
      ),
    )
    .slice(0, 8);
  if (ultimos.length === 0) return null;
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h3 className="mb-2 text-sm font-bold text-neutral-dark">Últimos documentos</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-mid">
              <th className="py-1 pr-3 font-semibold">Fecha</th>
              <th className="py-1 pr-3 font-semibold">Folio</th>
              <th className="py-1 pr-3 font-semibold">Tipo</th>
              <th className="py-1 text-right font-semibold">Monto</th>
            </tr>
          </thead>
          <tbody>
            {ultimos.map((d, i) => (
              <tr key={`${d.folio}-${i}`} className="border-t border-border/60">
                <td className="py-1.5 pr-3 tabular-nums text-neutral-dark">{d.fecha}</td>
                <td className="py-1.5 pr-3 tabular-nums text-neutral-mid">
                  {d.folio ?? "Folio no informado"}
                </td>
                <td className="py-1.5 pr-3 text-neutral-mid">
                  {customer360DocumentKind(d.tipoDoc) === "credit_note"
                    ? "Nota de crédito"
                    : customer360DocumentKind(d.tipoDoc) === "debit_note"
                      ? "Nota de débito"
                      : tipoDocMeta(d.tipoDoc).label}
                  {d.reclamado && (
                    <QavanteBadge variant="warning" className="ml-2">
                      R
                    </QavanteBadge>
                  )}
                </td>
                <td className="py-1.5 text-right font-semibold tabular-nums text-neutral-dark">
                  {formatClp(customer360SignedAmount(d))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Meses de diferencia entre dos períodos "YYYY-MM" (b − a). */
function periodDiff(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  if (!ay || !am || !by || !bm) return 0;
  return (by - ay) * 12 + (bm - am);
}
