"use client";

import * as React from "react";
import { Landmark, CheckCircle2, UserX, Undo2, ArrowRight, AlertTriangle } from "lucide-react";
import { QavanteBadge, QavanteButton, QavanteCard } from "@/components/qavante";
import { formatClp } from "@/lib/formatters/clp";
import { formatRut } from "@/lib/formatters/rut";
import { formatDateLike } from "@/lib/formatters/date";
import { cn } from "@/lib/utils";
import {
  workerPendiente,
  type SettlementBoard,
  type DebitoCandidato,
} from "./settlement-board-model";

/* Conciliación de sueldos ACCIONABLE (#835): el board del backend es la fuente de verdad. Deja:
   - CONCILIAR una-a-una (1 débito + 1 trabajador) o varias marcadas (1 débito + N trabajadores),
   - DESASIGNAR un match ya hecho (revert por link_id).
   Presentacional PURO: recibe el board + los candidatos de débito + callbacks. La selección es estado
   de UI local; la confirmación es explícita (mueve plata → nunca de un clic accidental). */

export interface ConciliacionBoardViewProps {
  periodLabel: string;
  board: SettlementBoard;
  /** Débitos del banco (categoría sueldos, sin asignar) elegibles para conciliar. */
  candidatos: DebitoCandidato[];
  /** Confirmado: asigna el débito a esos trabajadores (el contenedor hace dry-run + apply). */
  onAssign: (debitoId: string, workerRuts: string[]) => void;
  /** Deshace un match ya aplicado por su `link_id`. */
  onRevert: (linkId: string) => void;
  assignPending?: boolean;
  /** `link_id` que se está desasignando (spinner en esa fila), o `null`. */
  revertPendingId?: string | null;
}

export function ConciliacionBoardView({
  periodLabel,
  board,
  candidatos,
  onAssign,
  onRevert,
  assignPending = false,
  revertPendingId = null,
}: ConciliacionBoardViewProps) {
  const [debitoSel, setDebitoSel] = React.useState<string | null>(null);
  const [workersSel, setWorkersSel] = React.useState<Set<string>>(() => new Set());
  const [confirming, setConfirming] = React.useState(false);

  const pendientes = board.workers.filter(workerPendiente);
  const conciliados = board.links;

  // Al refrescar el board (tras asignar) los datos cambian → si la selección quedó vieja, límpiala.
  React.useEffect(() => {
    setDebitoSel((d) => (d && candidatos.some((c) => c.id === d) ? d : null));
    setWorkersSel((prev) => {
      const vivos = new Set(pendientes.map((w) => w.workerRut));
      const next = new Set([...prev].filter((r) => vivos.has(r)));
      return next.size === prev.size ? prev : next;
    });
    setConfirming(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, candidatos]);

  const debito = candidatos.find((c) => c.id === debitoSel) ?? null;
  const rutsSel = [...workersSel];
  const puedeConciliar = Boolean(debito) && rutsSel.length > 0;
  const nombresSel = pendientes.filter((w) => workersSel.has(w.workerRut)).map((w) => w.workerName);

  const toggleWorker = (rut: string) =>
    setWorkersSel((prev) => {
      const next = new Set(prev);
      if (next.has(rut)) next.delete(rut);
      else next.add(rut);
      return next;
    });

  const confirmAssign = () => {
    if (!debito || rutsSel.length === 0) return;
    onAssign(debito.id, rutsSel);
    // No cerramos el panel acá: mientras aplica, el botón muestra su spinner (loading=assignPending);
    // al refrescar el board el useEffect limpia selección + confirmación. Si falla, el panel queda
    // abierto para reintentar/cancelar.
  };

  return (
    <div className="space-y-4">
      {/* Resumen del período */}
      <QavanteCard variant="bordered">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-mid">
              {periodLabel}
            </p>
            <p className="mt-1 text-lg font-semibold text-neutral-dark">
              {conciliados.length} {conciliados.length === 1 ? "match" : "matches"} conciliado
              {conciliados.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {board.periodOutstanding > 0 ? (
              <QavanteBadge variant="warning">
                Falta conciliar {formatClp(board.periodOutstanding)}
              </QavanteBadge>
            ) : (
              <QavanteBadge variant="success">
                <CheckCircle2 className="mr-1 inline h-3 w-3" aria-hidden="true" />
                Período conciliado
              </QavanteBadge>
            )}
          </div>
        </div>
      </QavanteCard>

      {/* Zona de asignación: elige un débito + trabajador(es) → conciliar */}
      {pendientes.length > 0 && (
        <QavanteCard variant="bordered">
          <div className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-neutral-dark">
              <Landmark className="h-4 w-4 text-brand-primary" aria-hidden="true" />
              Conciliar sueldos
            </h3>
            <p className="text-xs text-neutral-mid">
              Elige un <b>débito del banco</b> y marca el/los <b>trabajador(es)</b> que pagó. Un
              débito puede cubrir a varios (un solo giro de sueldos).
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Débitos sin asignar */}
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
                  Débitos sin asignar ({candidatos.length})
                </p>
                {candidatos.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-neutral-mid">
                    No hay débitos de sueldos sin asignar en el período.
                  </p>
                ) : (
                  <ul
                    className="max-h-64 space-y-1 overflow-y-auto"
                    role="radiogroup"
                    aria-label="Débitos sin asignar"
                  >
                    {candidatos.map((c) => {
                      const sel = c.id === debitoSel;
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={sel}
                            onClick={() => {
                              setDebitoSel(sel ? null : c.id);
                              setConfirming(false);
                            }}
                            className={cn(
                              "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                              sel
                                ? "border-brand-primary bg-brand-primary-50"
                                : "border-border hover:bg-neutral-light/30",
                            )}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-neutral-dark">
                                {c.glosa || "s/d"}
                              </span>
                              <span className="block text-[11px] text-neutral-mid">
                                {formatDateLike(c.date)}
                              </span>
                            </span>
                            <span className="shrink-0 whitespace-nowrap font-semibold tabular-nums text-neutral-dark">
                              {formatClp(c.monto)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Trabajadores sin conciliar */}
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
                  Trabajadores sin conciliar ({pendientes.length})
                </p>
                <ul className="max-h-64 space-y-1 overflow-y-auto">
                  {pendientes.map((w) => {
                    const sel = workersSel.has(w.workerRut);
                    return (
                      <li key={w.workerRut}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                            sel
                              ? "border-brand-primary bg-brand-primary-50"
                              : "border-border hover:bg-neutral-light/30",
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <input
                              type="checkbox"
                              checked={sel}
                              onChange={() => {
                                toggleWorker(w.workerRut);
                                setConfirming(false);
                              }}
                              className="h-4 w-4 shrink-0 accent-brand-primary"
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-neutral-dark">
                                {w.workerName}
                              </span>
                              <span className="block font-mono text-[11px] text-neutral-mid">
                                {w.workerRut ? formatRut(w.workerRut) : "s/d"}
                              </span>
                            </span>
                          </span>
                          <span className="shrink-0 whitespace-nowrap tabular-nums text-neutral-mid">
                            {formatClp(w.outstanding)}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            {/* Barra de acción + confirmación explícita */}
            {!confirming ? (
              <div className="flex items-center justify-end">
                <QavanteButton
                  size="sm"
                  disabled={!puedeConciliar || assignPending}
                  onClick={() => setConfirming(true)}
                >
                  Conciliar
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </QavanteButton>
              </div>
            ) : (
              <div className="rounded-lg border border-brand-primary/40 bg-brand-primary-50/60 p-3 text-sm">
                <p className="text-neutral-dark">
                  Asignar <b className="tabular-nums">{formatClp(debito?.monto ?? 0)}</b> del débito
                  «{debito?.glosa || "s/d"}» a{" "}
                  <b>
                    {nombresSel.length === 1 ? nombresSel[0] : `${nombresSel.length} trabajadores`}
                  </b>
                  {nombresSel.length > 1 && (
                    <span className="text-neutral-mid"> ({nombresSel.join(", ")})</span>
                  )}
                  .
                </p>
                <div className="mt-2 flex items-center justify-end gap-2">
                  <QavanteButton
                    size="sm"
                    variant="ghost"
                    disabled={assignPending}
                    onClick={() => setConfirming(false)}
                  >
                    Cancelar
                  </QavanteButton>
                  <QavanteButton size="sm" loading={assignPending} onClick={confirmAssign}>
                    Confirmar conciliación
                  </QavanteButton>
                </div>
              </div>
            )}
          </div>
        </QavanteCard>
      )}

      {/* Conciliados: cada match con su botón de desasignar (el caso Carrasco) */}
      {conciliados.length > 0 && (
        <QavanteCard variant="bordered">
          <div className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-success-600">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Conciliados <span className="text-neutral-mid">({conciliados.length})</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border-strong text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
                    <th className="py-2 pr-3 font-semibold">Trabajador</th>
                    <th className="py-2 pr-3 text-right font-semibold">Monto</th>
                    <th className="py-2 pr-3 font-semibold">Débito (glosa)</th>
                    <th className="py-2 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {conciliados.map((l) => {
                    const reverting = revertPendingId === l.linkId;
                    return (
                      <tr key={l.linkId} className="border-b border-border/60 last:border-b-0">
                        <td className="py-2 pr-3 text-neutral-dark">{l.workerName}</td>
                        <td className="py-2 pr-3 text-right tabular-nums font-medium text-neutral-dark">
                          {formatClp(l.amount)}
                        </td>
                        <td className="max-w-[220px] truncate py-2 pr-3 text-xs text-neutral-mid">
                          {l.glosa || "s/d"}
                        </td>
                        <td className="py-2 text-right">
                          <QavanteButton
                            size="sm"
                            variant="ghost"
                            loading={reverting}
                            disabled={reverting}
                            onClick={() => onRevert(l.linkId)}
                            className="text-danger-500 hover:bg-danger-500/10"
                          >
                            {!reverting && <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />}
                            Desasignar
                          </QavanteButton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </QavanteCard>
      )}

      {pendientes.length === 0 && conciliados.length === 0 && (
        <QavanteCard variant="bordered">
          <div className="flex items-center gap-2 py-3 text-sm text-neutral-mid">
            <UserX className="h-4 w-4" aria-hidden="true" />
            No hay trabajadores con líquido en el período para conciliar.
          </div>
        </QavanteCard>
      )}

      <p className="flex items-start gap-1.5 text-xs text-neutral-mid">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        La conciliación mueve el estado de pago del trabajador. Revisa el débito antes de confirmar;
        si te equivocaste, «Desasignar» lo deshace. Fuente: Remuneraciones (BUK) + cartola del
        banco.
      </p>
    </div>
  );
}
