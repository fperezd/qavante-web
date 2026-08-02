"use client";

import { useMemo } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import {
  useClassificationProposals,
  useConfirmClassification,
  useOperationalResultDocuments,
  useRunClassification,
} from "@/lib/api/gestion";
import { useManagementAccountsTree, type ManagementAccountNode } from "@/lib/api/management";
import { formatClp } from "@/lib/formatters/clp";
import { parseAmount } from "./gestion-format";

/* Drill-down por documento (CC-API #786): la lista de facturas que caen en una cuenta de gestión en un
   mes. Reusable en cualquier pantalla de costos (Punto de equilibrio, Resultado, Costos y gastos…).
   Hace su propio fetch — el padre lo monta solo al expandir la línea, así el request corre on-demand.
   Degrada honesto: cargando / error / sin documentos.

   Clasificar en el propio detalle (pedido de Fernando 2026-08-01): SOLO en la cuenta "sin clasificar",
   cada documento trae su cuenta sugerida (motor del backend, IA + aprendizaje por contraparte —
   ADR-0062) con un botón para clasificarlo en un clic. Confirmar aplica la sugerencia Y crea una regla
   por la contraparte: los próximos documentos de ese proveedor se clasifican solos. Es GENÉRICO
   (cualquier empresa) — la sugerencia y la regla las decide el backend por tenant, nada hardcodeado.

   Las propuestas no existen hasta correr el clasificador: el botón "Sugerir clasificación" dispara el
   job del período (aplica lo obvio, propone el resto). Por eso la UI de clasificar vive solo acá, en
   la cuenta sin clasificar (código `unclassified.*`), no en las cuentas ya clasificadas. */

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
  // Propuestas de clasificación + nombres de cuenta. Solo en la cuenta sin clasificar y con el detalle
  // abierto. Ambos queries son COMPARTIDOS (misma queryKey) → React Query los deduplica entre todos los
  // drill-downs abiertos: un solo request por página, no uno por línea.
  const proposalsQuery = useClassificationProposals(enabled && esSinClasificar);
  const accountsQuery = useManagementAccountsTree();
  const confirm = useConfirmClassification();
  const runClassify = useRunClassification();

  const propuestaPorDoc = useMemo(() => {
    const m = new Map<string, { id: string; accountCode: string }>();
    for (const p of proposalsQuery.data?.proposals ?? []) {
      // Primera propuesta por documento (el backend entrega una por decisión).
      if (p.source_external_id && !m.has(p.source_external_id)) {
        m.set(p.source_external_id, { id: p.id, accountCode: p.account_code });
      }
    }
    return m;
  }, [proposalsQuery.data]);

  const nombresCuenta = useMemo(
    () => mapaNombresCuenta(accountsQuery.data?.items),
    [accountsQuery.data],
  );

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

  // ¿Quedan documentos sin una sugerencia todavía? → ofrecer correr el clasificador.
  const faltanSugerencias =
    esSinClasificar &&
    docs.some((d) => !d.source_external_id || !propuestaPorDoc.has(d.source_external_id));
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
          {runClassify.isError && (
            <span className="text-[10.5px] text-danger-500">
              No pudimos sugerir. Vuelve a intentar.
            </span>
          )}
        </div>
      )}

      <ul className="space-y-1.5">
        {docs.map((d, i) => {
          const propuesta = d.source_external_id
            ? propuestaPorDoc.get(d.source_external_id)
            : undefined;
          const sugerida = propuesta ? (nombresCuenta.get(propuesta.accountCode) ?? null) : null;
          const clasificando = confirm.isPending && confirm.variables === propuesta?.id;
          const falló = confirm.isError && confirm.variables === propuesta?.id;
          return (
            <li
              key={d.document_ref ?? d.source_external_id ?? String(i)}
              className="flex flex-col gap-0.5 text-[11.5px]"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-neutral-dark">
                  {d.document_ref && (
                    <span className="tabular-nums text-neutral-mid">{d.document_ref} · </span>
                  )}
                  {d.counterparty ?? "—"}
                </span>
                <span className="shrink-0 font-medium tabular-nums text-neutral-dark">
                  {formatClp(Math.round(Math.abs(parseAmount(d.net_amount))))}
                </span>
              </div>
              {propuesta && (
                <div className="flex items-center justify-between gap-3 pl-0.5">
                  <span className="inline-flex min-w-0 items-center gap-1 text-[10.5px] text-neutral-mid">
                    <Sparkles className="size-3 shrink-0 text-brand-500" aria-hidden />
                    <span className="truncate">
                      {sugerida ? (
                        <>
                          Sugerido:{" "}
                          <span className="font-medium text-neutral-dark">{sugerida}</span>
                        </>
                      ) : (
                        "Sugerencia disponible"
                      )}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => confirm.mutate(propuesta.id)}
                    disabled={clasificando}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10.5px] font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-60"
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
