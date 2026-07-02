"use client";

import * as React from "react";
import { FileText, Layers, X, XCircle } from "lucide-react";
import { QavanteBadge, QavanteCard } from "@/components/qavante";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import { formatRut } from "@/lib/formatters/rut";
import { cn } from "@/lib/utils";
import { tipoDocMeta } from "@/components/sii/tipo-doc";
import {
  agruparConReferencias,
  type EstadoDoc,
  type FacturaRow,
  type LibroDoc,
} from "./libro-anuladas-format";

/* Libro de Ventas con Notas de Crédito vinculadas — propuesta UX (estilo Chipax).
 *
 * Cuando una NC anula una factura, la factura se muestra como **"Anulada"** (no
 * factura + NC sueltas). Clic en la fila → modal "Documentos asociados" (factura
 * + NC + neto). Totales neteados (brutas − NC). La vinculación usa la referencia
 * REAL del DTE (`ref_tipo_doc`/`ref_folio`); solo cae a heurística (RUT + monto)
 * para NC sin referencia. */

const ESTADO_BADGE: Record<EstadoDoc, { variant: "danger" | "warning" | "default"; label: string }> = {
  anulada: { variant: "danger", label: "Anulada" },
  parcial: { variant: "warning", label: "Anulada parcial" },
  vigente: { variant: "default", label: "Vigente" },
};

export function LibroAnuladasView({ docs, periodo }: { docs: LibroDoc[]; periodo?: string }) {
  const grouped = React.useMemo(() => agruparConReferencias(docs), [docs]);
  const [selected, setSelected] = React.useState<FacturaRow | null>(null);

  return (
    <div className="space-y-4">
      {periodo && (
        <div className="flex items-center justify-between">
          <span className="font-medium text-neutral-dark">{periodo}</span>
          <QavanteBadge variant="info">{grouped.rows.length} documentos</QavanteBadge>
        </div>
      )}

      <QavanteCard variant="bordered" className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs [&_td]:border-r [&_td]:border-border/30 [&_td:last-child]:border-r-0">
            <thead className="bg-surface-muted">
              <tr className="border-b border-border-strong text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
                <th scope="col" className="px-3 py-2.5">Documento</th>
                <th scope="col" className="px-3 py-2.5">Cliente</th>
                <th scope="col" className="px-3 py-2.5">Fecha</th>
                <th scope="col" className="px-3 py-2.5 text-right">Monto</th>
                <th scope="col" className="px-3 py-2.5">Estado</th>
              </tr>
            </thead>
            <tbody>
              {grouped.rows.map((row, i) => {
                const meta = tipoDocMeta(row.factura.tipo_doc ?? null);
                const estado = ESTADO_BADGE[row.estado];
                const clickable = row.notas.length > 0;
                return (
                  <tr
                    key={`${row.factura.folio}-${i}`}
                    onClick={clickable ? () => setSelected(row) : undefined}
                    onKeyDown={
                      clickable
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelected(row);
                            }
                          }
                        : undefined
                    }
                    tabIndex={clickable ? 0 : undefined}
                    role={clickable ? "button" : undefined}
                    className={cn(
                      "border-b border-border/40 transition-colors last:border-b-0 even:bg-surface-muted/30",
                      clickable && "cursor-pointer hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary",
                      row.estado === "anulada" && "text-neutral-mid",
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-neutral-mid" aria-hidden="true" />
                        <span className={cn("font-mono", row.estado === "anulada" && "line-through")}>
                          {meta.abbr} {row.factura.folio}
                        </span>
                      </span>
                    </td>
                    <td className={cn("px-3 py-2.5 text-neutral-dark", row.estado === "anulada" && "text-neutral-mid line-through")}>
                      {row.factura.razon_social ?? "Sin nombre"}
                      <span className="ml-1 text-neutral-mid">{formatRut(row.factura.rut_contraparte ?? "")}</span>
                    </td>
                    <td className="px-3 py-2.5 text-neutral-dark">{formatDateLike(row.factura.fecha)}</td>
                    <td className={cn("px-3 py-2.5 text-right tabular-nums text-neutral-dark", row.estado === "anulada" && "line-through")}>
                      {formatClp(row.factura.monto_total ?? 0)}
                    </td>
                    <td className="px-3 py-2.5">
                      {row.estado === "vigente" ? (
                        <span className="text-neutral-mid">—</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <QavanteBadge variant={estado.variant}>
                            <XCircle className="mr-1 inline h-3 w-3" aria-hidden="true" />
                            {estado.label}
                          </QavanteBadge>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected(row);
                            }}
                            className="inline-flex items-center gap-0.5 text-brand-primary hover:underline"
                          >
                            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                            asociados
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border-strong">
                <td colSpan={3} className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
                  Ventas netas del período
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-neutral-dark">
                  {formatClp(grouped.totalNetas)}
                </td>
                <td className="px-3 py-2.5 text-[11px] text-neutral-mid">
                  brutas {formatClp(grouped.totalBrutas)} · NC −{formatClp(grouped.totalNc)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </QavanteCard>

      <p className="text-[11px] text-neutral-mid">
        Las facturas anuladas por nota de crédito se muestran vinculadas por la referencia del DTE
        (SII).
        {grouped.rows.some((r) => r.notas.length > 0 && !r.matchExacto) &&
          " Algunas notas sin referencia se vincularon por RUT y monto (referencial)."}
      </p>

      {selected && <AsociadosModal row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

/* ── Modal "Documentos asociados" ─────────────────────────────────────── */

function AsociadosModal({ row, onClose }: { row: FacturaRow; onClose: () => void }) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const docs: LibroDoc[] = [row.factura, ...row.notas];

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
          <button type="button" onClick={onClose} className="rounded-md p-1 text-surface/80 hover:bg-surface/10 hover:text-surface" aria-label="Cerrar">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="p-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
                <th className="py-2 pr-3">Folio</th>
                <th className="py-2 pr-3">Emisor</th>
                <th className="py-2 pr-3">Fecha</th>
                <th className="py-2 text-right">Monto total</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d, i) => {
                const meta = tipoDocMeta(d.tipo_doc ?? null);
                const isNC = i > 0;
                return (
                  <tr key={`${d.folio}-${i}`} className="border-b border-border/50 last:border-b-0">
                    <td className="py-2.5 pr-3">
                      <QavanteBadge variant={isNC ? "danger" : "success"}>
                        {meta.abbr} {d.folio}
                      </QavanteBadge>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="block text-neutral-dark">{d.razon_social ?? "Sin nombre"}</span>
                      <span className="text-xs text-neutral-mid">{formatRut(d.rut_contraparte ?? "")}</span>
                    </td>
                    <td className="py-2.5 pr-3 text-neutral-dark">{formatDateLike(d.fecha)}</td>
                    <td className="py-2.5 text-right tabular-nums text-neutral-dark">
                      {formatClp(d.monto_total ?? 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border-strong">
                <td colSpan={3} className="py-2.5 pr-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
                  Neto
                </td>
                <td className={cn("py-2.5 text-right text-base font-semibold tabular-nums", row.neto <= 0 ? "text-danger-500" : "text-neutral-dark")}>
                  {formatClp(row.neto)}
                </td>
              </tr>
            </tfoot>
          </table>
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
