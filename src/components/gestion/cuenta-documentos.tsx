"use client";

import { useOperationalResultDocuments } from "@/lib/api/gestion";
import { formatClp } from "@/lib/formatters/clp";
import { parseAmount } from "./gestion-format";

/* Drill-down por documento (CC-API #786): la lista de facturas que caen en una cuenta de gestión en un
   mes. Reusable en cualquier pantalla de costos (Punto de equilibrio, Resultado, Costos y gastos…).
   Hace su propio fetch — el padre lo monta solo al expandir la línea, así el request corre on-demand.
   Degrada honesto: cargando / error / sin documentos. */
export function CuentaDocumentos({
  period,
  accountCode,
  enabled = true,
}: {
  period: string;
  accountCode: string;
  enabled?: boolean;
}) {
  const query = useOperationalResultDocuments(period, accountCode, enabled);

  if (query.isError) {
    return (
      <p className="text-[11px] text-danger-500">No pudimos cargar las facturas de esta cuenta.</p>
    );
  }
  if (query.isLoading || !query.data) {
    return (
      <p className="text-[11px] text-neutral-mid" aria-busy="true">
        Cargando facturas…
      </p>
    );
  }
  const docs = query.data.documents ?? [];
  if (docs.length === 0) {
    return <p className="text-[11px] text-neutral-mid">Sin documentos para el detalle.</p>;
  }
  return (
    <ul className="space-y-1">
      {docs.map((d, i) => (
        <li
          key={d.document_ref ?? d.source_external_id ?? String(i)}
          className="flex items-center justify-between gap-3 text-[11.5px]"
        >
          <span className="min-w-0 truncate text-neutral-dark">
            {d.document_ref && (
              <span className="tabular-nums text-neutral-mid">{d.document_ref} · </span>
            )}
            {d.counterparty ?? "—"}
          </span>
          <span className="shrink-0 font-medium tabular-nums text-neutral-dark">
            {formatClp(Math.round(Math.abs(parseAmount(d.net_amount))))}
          </span>
        </li>
      ))}
    </ul>
  );
}
