"use client";

import * as React from "react";
import { toast } from "sonner";
import { CashProjectionRunPanel } from "@/components/cash-projection-runs/cash-projection-run-panel";
import { useCashProjection } from "@/lib/api/treasury";
import { useMarkCollected, useMarkCollectedRevert } from "@/lib/api/reconciliation";

export interface CajaProyeccionLiveProps {
  saldoHoy: number;
  minimo: number | null;
  saldoStale?: boolean;
  ultimaSync?: string | null;
  markCollectedEnabled?: boolean;
}

/**
 * D03 reemplaza el medidor/cascada derivados en frontend por el run inmutable del backend.
 * Las props históricas se conservan para compatibilidad de llamada, pero no participan del cálculo.
 */
export function CajaProyeccionLive({ markCollectedEnabled = false }: CajaProyeccionLiveProps) {
  const legacy = useCashProjection(90);
  const mark = useMarkCollected();
  const revert = useMarkCollectedRevert();
  const [expanded, setExpanded] = React.useState(false);
  const [reconciled, setReconciled] = React.useState<Set<string>>(new Set());
  const documents = React.useMemo(
    () =>
      (legacy.data?.vencido?.items ?? [])
        .filter((item) => (item.tipo ?? "").startsWith("cobro"))
        .map((item) => ({
          glosa: item.glosa,
          sourceExternalId: item.source_external_id ?? null,
          side: (item.side === "payable" ? "payable" : "receivable") as "payable" | "receivable",
        })),
    [legacy.data],
  );

  return (
    <div className="space-y-4">
      <CashProjectionRunPanel horizonDays={90} title="Proyección canónica" />
      {markCollectedEnabled && documents.length > 0 && (
        <section className="rounded-xl border border-border bg-surface p-4">
          <button
            type="button"
            className="font-semibold text-brand-primary"
            onClick={() => setExpanded((value) => !value)}
          >
            {documents.length} documentos vencidos o sin fecha · gestionar conciliación
          </button>
          {expanded && (
            <ul className="mt-3 space-y-2">
              {documents.map((document) => {
                const id = document.sourceExternalId;
                const done = id ? reconciled.has(id) : false;
                return (
                  <li
                    key={id ?? document.glosa}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span>{document.glosa}</span>
                    {id &&
                      (done ? (
                        <span>
                          Conciliado ✓{" "}
                          <button
                            type="button"
                            className="font-semibold text-brand-primary"
                            onClick={() =>
                              revert.mutate(
                                { source_external_ids: [id], side: document.side },
                                {
                                  onSuccess: () => {
                                    setReconciled((current) => {
                                      const next = new Set(current);
                                      next.delete(id);
                                      return next;
                                    });
                                    toast.success("Lo devolví a por cobrar.");
                                  },
                                },
                              )
                            }
                          >
                            Deshacer
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="font-semibold text-brand-primary"
                          onClick={() =>
                            mark.mutate(
                              { source_external_ids: [id], side: document.side },
                              {
                                onSuccess: () => {
                                  setReconciled((current) => new Set(current).add(id));
                                  toast.success("Listo, lo saqué de por cobrar.");
                                },
                              },
                            )
                          }
                        >
                          Ya lo cobré
                        </button>
                      ))}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
