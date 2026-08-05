"use client";

import { useMemo, useState } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import {
  useClassificationProposals,
  useClassifyDocument,
  useClassifyDocumentBatch,
  useOperationalResultDocuments,
  useRunClassification,
} from "@/lib/api/gestion";
import { useManagementAccountsTree, type ManagementAccountNode } from "@/lib/api/management";
import { formatClp } from "@/lib/formatters/clp";
import { montoDocEnCuenta } from "./gestion-format";

/* Drill-down por documento (CC-API #786): la lista de facturas que caen en una cuenta de gestión en un
   mes. Reusable en cualquier pantalla de costos (Punto de equilibrio, Resultado, Costos y gastos…).
   Hace su propio fetch — el padre lo monta solo al expandir la línea, así el request corre on-demand.

   Clasificar en el propio detalle (Fernando 2026-08-01/02): SOLO en la cuenta "sin clasificar", cada
   documento trae su cuenta SUGERIDA (motor del backend, IA + aprendizaje por contraparte — ADR-0062)
   PRECARGADA en un selector, editable: si la sugerencia está bien, un clic en "Clasificar"; si no llegó
   o está mal, se elige otra cuenta a mano. Clasificar aplica la elección Y aprende una regla por la
   contraparte (los próximos docs de ese proveedor se clasifican solos). GENÉRICO (cualquier empresa).
   Usa `classify-document` (documento-keyed): no depende de una propuesta viva, así que no sufre el
   problema de propuestas volátiles/stale. */

/** Aplana el árbol de cuentas del tenant a un mapa código→nombre legible (`display_name ?? name`). */
function mapaNombresCuenta(items: ManagementAccountNode[] | undefined): Map<string, string> {
  const m = new Map<string, string>();
  const walk = (nodes: ManagementAccountNode[]) => {
    for (const n of nodes) {
      m.set(n.code, n.display_name ?? n.name);
      if (n.children?.length) walk(n.children);
    }
  };
  if (items) walk(items);
  return m;
}

/** Opciones del selector: cuentas HOJA (clasificables) del tenant, sin las de ingreso (una compra no
 *  va a una cuenta de ventas). Ordenadas por nombre. */
function opcionesCuenta(
  items: ManagementAccountNode[] | undefined,
): { code: string; name: string }[] {
  const out: { code: string; name: string }[] = [];
  const walk = (nodes: ManagementAccountNode[]) => {
    for (const n of nodes) {
      if (n.children?.length) walk(n.children);
      else if (n.code && n.type !== "income")
        out.push({ code: n.code, name: n.display_name ?? n.name });
    }
  };
  if (items) walk(items);
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function CuentaDocumentos({
  period,
  accountCode,
  enabled = true,
}: {
  period: string;
  accountCode: string;
  enabled?: boolean;
}) {
  // La cuenta "sin clasificar" (código `unclassified.*`, convención del backend — no de un tenant) es
  // la única donde tiene sentido sugerir/clasificar. En el resto, el drill-down es solo lectura.
  const esSinClasificar = accountCode.startsWith("unclassified");

  const query = useOperationalResultDocuments(period, accountCode, enabled);
  const proposalsQuery = useClassificationProposals(enabled && esSinClasificar);
  const accountsQuery = useManagementAccountsTree();
  const classify = useClassifyDocument();
  const classifyBatch = useClassifyDocumentBatch();
  const runClassify = useRunClassification();

  // Cuenta elegida a mano por documento (source_external_id → account_code). Si el usuario no tocó el
  // selector, cae a la sugerencia del backend.
  const [seleccion, setSeleccion] = useState<Record<string, string>>({});

  const propuestaPorDoc = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of proposalsQuery.data?.proposals ?? []) {
      if (p.source_external_id && !m.has(p.source_external_id))
        m.set(p.source_external_id, p.account_code);
    }
    return m;
  }, [proposalsQuery.data]);

  const nombresCuenta = useMemo(
    () => mapaNombresCuenta(accountsQuery.data?.items),
    [accountsQuery.data],
  );
  const opciones = useMemo(() => opcionesCuenta(accountsQuery.data?.items), [accountsQuery.data]);

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
  // Monto de cada doc firmado RELATIVO a la cuenta (ver `montoDocEnCuenta`): la NC queda negativa y la
  // lista reconcilia con el monto de la línea. Antes un `Math.abs` la pintaba como gasto extra.
  const totalCuenta = query.data.total;

  /** Cuenta elegida para un doc: lo que el usuario seleccionó, o la sugerencia del backend. */
  const cuentaDe = (seid: string | null | undefined): string =>
    (seid && (seleccion[seid] ?? propuestaPorDoc.get(seid))) || "";

  const faltanSugerencias =
    esSinClasificar &&
    docs.some((d) => !d.source_external_id || !propuestaPorDoc.has(d.source_external_id));
  // "Clasificar todo": los docs con una cuenta ya elegida (sugerida o a mano) → un request por doc.
  const lote = esSinClasificar
    ? docs
        .filter((d) => d.source_external_id && cuentaDe(d.source_external_id))
        .map((d) => ({
          side: d.side,
          source_external_id: d.source_external_id as string,
          account_code: cuentaDe(d.source_external_id),
        }))
    : [];
  const run = runClassify.data;
  const llmApagado = run?.status === "llm_off";

  return (
    <div className="space-y-2">
      {esSinClasificar && (
        <div className="flex flex-wrap items-center gap-2">
          {faltanSugerencias && (
            <button
              type="button"
              onClick={() => runClassify.mutate(period)}
              disabled={runClassify.isPending}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-60"
            >
              {runClassify.isPending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Wand2 className="size-3.5" aria-hidden />
              )}
              {runClassify.isPending ? "Analizando…" : "Sugerir clasificación"}
            </button>
          )}
          {lote.length >= 2 && (
            <button
              type="button"
              onClick={() => classifyBatch.mutate(lote)}
              disabled={classifyBatch.isPending}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-300 bg-brand-100 px-2.5 py-1 text-[11px] font-semibold text-brand-700 transition hover:bg-brand-200 disabled:opacity-60"
            >
              {classifyBatch.isPending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-3.5" aria-hidden />
              )}
              {classifyBatch.isPending ? "Clasificando…" : `Clasificar todo (${lote.length})`}
            </button>
          )}
          {classifyBatch.data && (
            <span className="text-[10.5px] text-neutral-mid">
              {classifyBatch.data.ok} clasificada{classifyBatch.data.ok === 1 ? "" : "s"}
              {classifyBatch.data.faltaban > 0 && ` · ${classifyBatch.data.faltaban} falló`}
            </span>
          )}
          {run && !llmApagado && (
            <span className="text-[10.5px] text-neutral-mid">
              {run.applied > 0 &&
                `${run.applied} clasificada${run.applied === 1 ? "" : "s"} sola${run.applied === 1 ? "" : "s"}`}
              {run.applied > 0 && run.proposed > 0 && " · "}
              {run.proposed > 0 && `${run.proposed} con sugerencia para revisar`}
              {run.applied === 0 && run.proposed === 0 && "Sin sugerencias nuevas"}
            </span>
          )}
          {llmApagado && (
            <span className="text-[10.5px] text-neutral-mid">
              El clasificador automático no está disponible por ahora.
            </span>
          )}
        </div>
      )}

      <ul className="space-y-1.5">
        {docs.map((d, i) => {
          const seid = d.source_external_id ?? null;
          const elegido = cuentaDe(seid);
          const tieneSugerencia = Boolean(seid && propuestaPorDoc.has(seid));
          const clasificando =
            classify.isPending && classify.variables?.source_external_id === seid;
          const falló = classify.isError && classify.variables?.source_external_id === seid;
          return (
            <li
              key={d.document_ref ?? seid ?? String(i)}
              className="flex flex-col gap-0.5 text-[11.5px]"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-neutral-dark">
                  {d.document_ref && (
                    <span className="tabular-nums text-neutral-mid">{d.document_ref} · </span>
                  )}
                  {d.counterparty ?? "—"}
                </span>
                {(() => {
                  // Firmado relativo a la cuenta: reverso (NC) en negativo y atenuado (resta, no gasta).
                  const montoDoc = Math.round(montoDocEnCuenta(totalCuenta, d.net_amount));
                  return (
                    <span
                      className={
                        "shrink-0 font-medium tabular-nums " +
                        (montoDoc < 0 ? "text-neutral-mid" : "text-neutral-dark")
                      }
                    >
                      {formatClp(montoDoc)}
                    </span>
                  );
                })()}
              </div>
              {esSinClasificar && seid && (
                <div className="flex items-center justify-between gap-2 pl-0.5">
                  <span className="inline-flex min-w-0 flex-1 items-center gap-1">
                    {tieneSugerencia && (
                      <Sparkles className="size-3 shrink-0 text-brand-500" aria-hidden />
                    )}
                    {/* Selector precargado con la sugerencia; el usuario puede cambiarlo a mano. */}
                    <select
                      value={elegido}
                      onChange={(e) => setSeleccion((s) => ({ ...s, [seid]: e.target.value }))}
                      aria-label={`Clasificar ${d.counterparty ?? "documento"} como`}
                      className="min-w-0 flex-1 truncate rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10.5px] text-neutral-dark"
                    >
                      <option value="">Elegir cuenta…</option>
                      {opciones.map((o) => (
                        <option key={o.code} value={o.code}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      classify.mutate({
                        side: d.side,
                        source_external_id: seid,
                        account_code: elegido,
                      })
                    }
                    disabled={!elegido || clasificando}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10.5px] font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-50"
                  >
                    {clasificando && <Loader2 className="size-3 animate-spin" aria-hidden />}
                    {clasificando ? "Clasificando…" : "Clasificar"}
                  </button>
                </div>
              )}
              {falló && (
                <span className="pl-0.5 text-[10px] text-danger-500">
                  No pudimos clasificar. Vuelve a intentar.
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
