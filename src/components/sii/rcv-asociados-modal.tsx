"use client";

import * as React from "react";
import { X } from "lucide-react";
import { QavanteBadge } from "@/components/qavante";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import { tipoDocMeta } from "./tipo-doc";
import type { AnulableDoc, FacturaRow } from "./rcv-anuladas";

function mag(v: number | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.abs(v) : 0;
}

/* Modal "Documentos asociados" — muestra una factura anulada/parcial junto con
   las notas de crédito que la modifican y el neto resultante. Estilo Chipax.
   Se abre al hacer clic en una fila anulada del Libro. */

export function RcvAsociadosModal({
  row,
  partyLabel,
  onClose,
}: {
  row: FacturaRow;
  partyLabel: string;
  onClose: () => void;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const docs: AnulableDoc[] = [row.factura, ...row.notas];
  const ncTotal = row.notas.reduce((a, n) => a + mag(n.monto_total), 0);
  const facturaTotal = mag(row.factura.monto_total);
  /* neto real puede quedar negativo si las NC superan la factura (anomalía del
     SII, p.ej. varias NC apuntando al mismo folio). No mostramos negativo: se
     muestra $0 (factura cancelada) y se explica el sobre-crédito. */
  const netoMostrado = Math.max(0, row.neto);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-dark/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Documentos asociados"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-brand-primary px-5 py-3">
          <h2 className="text-base font-semibold text-surface">Documentos asociados</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-surface/80 hover:bg-surface/10 hover:text-surface"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="p-5">
          {row.sobreCredito && (
            <p className="mb-3 rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-500">
              <strong>Revisar:</strong> las {row.notas.length} notas de crédito (
              {formatClp(ncTotal)}) superan el monto de la factura ({formatClp(facturaTotal)}).
              Suele ser un error de referencia en el SII (varias NC apuntando al mismo folio). La
              factura se considera anulada; el exceso conviene revisarlo con tu contador.
            </p>
          )}
          {!row.matchExacto && !row.sobreCredito && (
            <p className="mb-3 rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700">
              Vinculación referencial (por {partyLabel.toLowerCase()} y monto): esta nota de crédito
              no traía la referencia exacta del documento en el SII.
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
                  <th className="py-2 pr-3">Documento</th>
                  <th className="py-2 pr-3">{partyLabel}</th>
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 text-right">Monto total</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d, i) => {
                  const meta = tipoDocMeta(d.tipo_doc ?? null);
                  const isNC = i > 0;
                  return (
                    <tr
                      key={`${d.folio}-${i}`}
                      className="border-b border-border/50 last:border-b-0"
                    >
                      <td className="py-2.5 pr-3">
                        <QavanteBadge variant={isNC ? "danger" : "success"}>
                          {meta.abbr} {d.folio}
                        </QavanteBadge>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="block text-neutral-dark">
                          {d.razon_social ?? "Sin nombre"}
                        </span>
                        {d.rut_contraparte && (
                          <span className="block font-mono text-xs text-neutral-mid">
                            {d.rut_contraparte}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-neutral-dark">{formatDateLike(d.fecha)}</td>
                      <td className="py-2.5 text-right tabular-nums text-neutral-dark">
                        {/* "—" honesto si el doc no trae monto (convención del módulo
                            RCV), en vez de "$0" que aparentaría un documento en cero. */}
                        {typeof d.monto_total === "number" ? formatClp(d.monto_total) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border-strong">
                  <td
                    colSpan={3}
                    className="py-2.5 pr-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-mid"
                  >
                    Neto
                  </td>
                  <td
                    className={
                      "py-2.5 text-right text-base font-semibold tabular-nums " +
                      (netoMostrado <= 0 ? "text-danger-500" : "text-neutral-dark")
                    }
                  >
                    {formatClp(netoMostrado)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        <div className="flex justify-end border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-1.5 text-sm font-medium text-neutral-dark hover:bg-surface-muted"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
