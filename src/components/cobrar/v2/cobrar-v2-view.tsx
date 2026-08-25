"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, FileOutput, CircleCheck } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { AmountCountUp } from "@/components/qavante/amount-count-up";
import { InfoHint } from "@/components/ui/info-hint";
import { formatClp } from "@/lib/formatters/clp";
import { formatRut } from "@/lib/formatters/rut";
import { formatDate, formatDateLike } from "@/lib/formatters/date";
import { cn } from "@/lib/utils";
import type { AgingBreakdown, VencidoSinDato } from "../cobranza-format";
import { AgingBarraDesconocida, AgingDesconocido } from "../aging-desconocido";
import { CobranzaAcciones } from "./cobranza-acciones";
import { peorMoraDias, isGestionadoDoc, type GestionadoMap } from "./cobrar-v2-map";
import type { DocMaestro } from "@/components/terminos/terminos-pago";

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
  /** Antigüedad de saldos — solo si hay vencimientos (modo urgencia). Los tramos
   *  pueden venir en `null` (= no se sabe): eso SE MUESTRA, no se pinta como 0. */
  aging?: AgingBreakdown;
  /** Por qué no se puede computar la mora (para el estado "sin dato" del aging). */
  agingSinDato?: VencidoSinDato;
  /** Filas de deudores (cada una con sus acciones), ya construidas por el contenedor. */
  deudores: React.ReactNode;
  /** Barra "Ordenar por" (opcional): el default es el orden curado por prioridad. */
  sortControl?: React.ReactNode;
  /** Banner de datos parciales (falta sincronizar). */
  banner?: React.ReactNode;
  /** Acceso al Libro de Ventas SII (si `siiQueries`). */
  siiEnabled?: boolean;
}

export function CobrarV2View({
  hero,
  resumen,
  aging,
  agingSinDato,
  deudores,
  sortControl,
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

      {/* Se muestra si hay algo que mostrar O si el dato es DESCONOCIDO: esconder la
          tarjeta cuando no se sabe es otra forma de decir "no hay nada vencido". */}
      {aging && (aging.incomplete || aging.bars.some((b) => (b.amount ?? 0) > 0)) && (
        <AgingCard aging={aging} sinDato={agingSinDato} />
      )}

      {/* A quién cobrarle — por defecto ordenados por prioridad; el usuario puede reordenar. */}
      <QavanteCard
        variant="bordered"
        header={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">A quién cobrarle</span>
            {sortControl}
          </div>
        }
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

/* Antigüedad de saldos. Con algún tramo en `null` (qavante-api#123) la barra apilada
   NO se pinta: con los cuatro tramos de mora desconocidos quedaba 100% "Vigente", o sea
   "todo al día" justo cuando no se sabe nada (hallazgo H6). En su lugar va la franja de
   desconocimiento + el porqué. Los tramos sin dato se rotulan "s/d"; el vigente, que el
   contrato garantiza no-null, conserva su monto real. */
function AgingCard({ aging, sinDato }: { aging: AgingBreakdown; sinDato?: VencidoSinDato }) {
  return (
    <QavanteCard
      variant="bordered"
      header={<span className="font-medium">Antigüedad de saldos</span>}
    >
      {aging.incomplete ? (
        <AgingBarraDesconocida />
      ) : (
        <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-light/40 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]">
          <div className="animate-qv-grow-x flex h-full w-full origin-left">
            {aging.bars.map((b) => (
              <div
                key={b.key}
                className={AGING_COLOR[b.key]}
                style={{ width: `${b.pct ?? 0}%` }}
                title={`${b.label}: ${formatClp(b.amount ?? 0)}`}
              />
            ))}
          </div>
        </div>
      )}
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-5">
        {aging.bars.map((b) => (
          <div key={b.key} className="flex flex-col">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
              {b.label}
            </dt>
            <dd
              className={cn(
                "font-semibold tabular-nums",
                b.amount == null ? "text-neutral-mid" : "text-neutral-dark",
              )}
            >
              {b.amount == null ? "s/d" : formatClp(b.amount)}
            </dd>
          </div>
        ))}
      </dl>
      {aging.incomplete && sinDato && <AgingDesconocido sinDato={sinDato} />}
    </QavanteCard>
  );
}

/* ── Resumen honesto ──────────────────────────────────────────────────────────
 * Total + vencido + % vencido cuando el vencido se conoce (incluido el cero
 * verificado), o "sin dato" con el porqué cuando la API no pudo computarlo. */
const MOTIVO_GENERICO = "No podemos calcular cuánto está vencido con los datos que tenemos.";
export interface ResumenCobranzaProps {
  total: number;
  /** Vencido. `null` = la API NO pudo computarlo (qavante-api#123) — se dice que no
   *  se sabe. `0` = cero VERIFICADO: "estás al día", que NO es lo mismo. */
  overdue: number | null;
  overduePct: number | null;
  /** Monto ya marcado conciliado (en Clientes) que se descontó del total. */
  conciliado?: number;
  /** Por qué no se puede computar la mora (cuando `overdue` es `null`). */
  sinDato?: VencidoSinDato;
}

export function ResumenCobranza({
  total,
  overdue,
  overduePct,
  conciliado = 0,
  sinDato,
}: ResumenCobranzaProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Stat
        label="Total por cobrar"
        value={<AmountCountUp value={total} />}
        sub={conciliado > 0 ? `menos ${formatClp(conciliado)} conciliado` : undefined}
      />
      {/* Sólo dos caminos, y los decide el DATO, no un "modo" (H6):
          - `null` → no se sabe: se dice, con el porqué REAL que manda el backend.
          - un número → se muestra, incluido el `0`, que es un cero VERIFICADO
            ("estás al día") y NO puede esconderse detrás de una causa inventada.
          Antes acá había una tercera rama por `mode` que, con vencido 0, afirmaba
          "el SII todavía no entrega las fechas de vencimiento". Con el vencido
          derivado del RCV eso es sencillamente falso —el dato SÍ se conoce y da
          cero— y encima contradecía al hero, que en la misma pantalla decía "nada
          vencido". Desde #123 el "no se sabe" viaja como `null`: no hay que
          adivinarlo a partir de un cero. */}
      {overdue == null ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-muted/40 p-4 sm:col-span-2">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-neutral-dark">
            Vencido: sin dato
            <InfoHint label="Por qué no mostramos lo vencido">
              {sinDato?.motivo ?? MOTIVO_GENERICO} {sinDato?.accion}
            </InfoHint>
          </p>
          <p className="mt-1 text-[12px] text-neutral-mid">{sinDato?.motivo ?? MOTIVO_GENERICO}</p>
          {sinDato?.accion && (
            <p className="mt-1 text-[12px] font-medium text-neutral-dark">{sinDato.accion}</p>
          )}
        </div>
      ) : (
        <>
          <Stat
            label="Vencido"
            value={<AmountCountUp value={overdue} />}
            tone={overdue > 0 ? "danger" : undefined}
            sub={overdue === 0 ? "Estás al día: no tienes saldo vencido." : undefined}
          />
          <Stat
            label="% vencido"
            value={`${(overduePct ?? 0).toLocaleString("es-CL", { maximumFractionDigits: 1 })}%`}
            tone={(overduePct ?? 0) > 0 ? "danger" : undefined}
          />
        </>
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
  /** El contrato admite `rut: null` ("null si falta") → se dice, no se pinta vacío. */
  rut: string | null;
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
  /** Expansión a los documentos del deudor. Vienen del MAESTRO (mismo cálculo que el vencido de
   *  arriba) → cada uno con su vencimiento DERIVADO y los días de mora. */
  isOpen: boolean;
  onToggleOpen: () => void;
  docs: DocMaestro[];
  /** Facturas gestionadas (mapa `rut:folio`→ISO) + toggle por documento. */
  gestionadoDocs: GestionadoMap;
  onToggleDoc: (folio: number | string | null) => void;
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
    gestionadoDocs,
    onToggleDoc,
  } = props;

  // Mora "de un vistazo" (sin expandir): los días del documento más vencido.
  const mora = peorMoraDias(docs);

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
            <span className="block text-xs text-neutral-mid">
              {rut ? formatRut(rut) : "RUT no informado"}
            </span>
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
            <p className="text-xs font-medium text-danger-500">
              {formatClp(overdue)} vencido
              {mora != null && ` · hace ${mora} ${mora === 1 ? "día" : "días"}`}
            </p>
          )}
        </div>
      </div>

      <div className="pl-6">
        <CobranzaAcciones
          size="sm"
          tone="quiet"
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
        <DeudorDocsPanel
          docs={docs}
          rut={rut}
          gestionadoDocs={gestionadoDocs}
          onToggleDoc={onToggleDoc}
        />
      )}
    </li>
  );
}

/* Documentos del deudor (del maestro): folio + emisión + vencimiento DERIVADO (emisión + término de
   pago) + días de mora vs hoy + monto. Las NC se muestran restando (monto negativo), sin semántica de
   vencimiento. Es la misma fuente que el "vencido" de la fila → los números cuadran. */
function DeudorDocsPanel({
  docs,
  rut,
  gestionadoDocs,
  onToggleDoc,
}: {
  docs: DocMaestro[];
  rut: string | null;
  gestionadoDocs: GestionadoMap;
  onToggleDoc: (folio: number | string | null) => void;
}) {
  if (docs.length === 0) {
    return <p className="py-2 pl-6 text-xs text-neutral-mid">No hay documentos para mostrar.</p>;
  }
  return (
    <div className="mt-1 overflow-x-auto pl-6">
      <table className="w-full min-w-[500px] text-xs">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-mid">
            <th scope="col" className="py-1 pr-3 font-semibold">
              Folio
            </th>
            <th scope="col" className="py-1 pr-3 font-semibold">
              Emisión
            </th>
            <th scope="col" className="py-1 pr-3 font-semibold">
              Vence
            </th>
            <th scope="col" className="py-1 pr-3 font-semibold">
              Días
            </th>
            <th scope="col" className="py-1 pr-3 text-right font-semibold">
              Monto
            </th>
            <th scope="col" className="py-1 text-right font-semibold">
              <span className="sr-only">Gestión</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {docs.map((doc, i) => {
            // CEDIDA (factor) / RECLAMADA: NO son por-cobrar de la empresa (se excluyen del total del
            // deudor) → el detalle debe DECIRLO, no listarlas como cobrables. Si no, la suma del panel
            // no cuadra con la fila y aparece un botón "Marcar" para cobrar lo que ya no es tuyo.
            const excluida = !doc.esNotaCredito && (doc.cedido || doc.reclamado);
            const motivoExcluida = doc.cedido ? "Cedida" : "Reclamada";
            const gestionada =
              !doc.esNotaCredito && !excluida && isGestionadoDoc(gestionadoDocs, rut, doc.folio);
            return (
              <tr
                key={`${doc.folio}-${i}`}
                className={cn("border-t border-border/40", gestionada && "opacity-55")}
              >
                <td className="py-1.5 pr-3 tabular-nums text-neutral-dark">
                  {doc.esNotaCredito ? "NC " : ""}
                  {doc.folio ?? "s/d"}
                </td>
                <td className="py-1.5 pr-3 tabular-nums text-neutral-mid">
                  {doc.fechaEmision ? formatDate(doc.fechaEmision) : "s/d"}
                </td>
                <td className="py-1.5 pr-3 tabular-nums text-neutral-mid">
                  {doc.vencimiento ? formatDate(doc.vencimiento) : "s/d"}
                </td>
                <td className="py-1.5 pr-3 tabular-nums">
                  {excluida ? (
                    <span
                      className="rounded bg-neutral-light/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-mid"
                      title={
                        doc.cedido
                          ? "Cedida por factoring (RPETC): la cobra el factor, no cuenta como tu cobranza."
                          : "Reclamada en el SII: no es una obligación de cobro."
                      }
                    >
                      {motivoExcluida}
                    </span>
                  ) : gestionada ? (
                    <span className="text-neutral-mid">Gestionada</span>
                  ) : (
                    <DiasVencimiento doc={doc} />
                  )}
                </td>
                <td
                  className={cn(
                    "py-1.5 pr-3 text-right tabular-nums",
                    doc.esNotaCredito || excluida
                      ? "text-neutral-mid line-through"
                      : "text-neutral-dark",
                  )}
                >
                  {formatClp(doc.monto)}
                </td>
                <td className="py-1.5 text-right">
                  {/* Ni las NC (restan) ni las cedidas/reclamadas (no son tuyas) se gestionan/cobran. */}
                  {!doc.esNotaCredito && !excluida && (
                    <button
                      type="button"
                      onClick={() => onToggleDoc(doc.folio)}
                      aria-pressed={gestionada}
                      title={gestionada ? "Reabrir esta factura" : "Marcar esta factura gestionada"}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
                        gestionada
                          ? "text-success-700 hover:bg-success-500/10"
                          : "text-neutral-mid hover:bg-surface-muted hover:text-neutral-dark",
                      )}
                    >
                      <CircleCheck className="size-3.5" aria-hidden="true" />
                      {gestionada ? "Gestionada" : "Marcar"}
                    </button>
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

/* Días de mora del documento (negativo del maestro = vencida hace N; positivo = vence en N). Las NC y
   los docs sin fecha no tienen vencimiento → guion. */
function DiasVencimiento({ doc }: { doc: DocMaestro }) {
  if (doc.esNotaCredito || doc.diasParaVencer == null) {
    return <span className="text-neutral-mid">s/d</span>;
  }
  const d = doc.diasParaVencer;
  if (d < 0) return <span className="font-medium text-danger-500">Vencida hace {-d} d</span>;
  if (d === 0) return <span className="font-medium text-warning-700">Vence hoy</span>;
  return <span className="text-neutral-mid">En {d} d</span>;
}
