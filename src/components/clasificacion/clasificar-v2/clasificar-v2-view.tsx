"use client";

import * as React from "react";
import { Sparkles, Wand2 } from "lucide-react";
import { QavanteBadge, QavanteButton, QavanteCard } from "@/components/qavante";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import { cn } from "@/lib/utils";
import {
  classifiedPct,
  confidencePct,
  confidenceTone,
  parseAmount,
  sortByAmountDesc,
  totalPending,
  type Tone,
  type UnclassifiedMovement,
} from "./clasificar-v2-format";

/* "Por clasificar" v2 — propuesta UX (control de gestión) para /caja/por-clasificar.
 *
 * Un movimiento mal clasificado ensucia TODOS los reportes. Esta propuesta ataca
 * la fricción #1 (clasificar de a uno) y aprovecha la inteligencia que el backend
 * ya calcula: **progreso** ("quedan N · % clasificado"), **orden por monto**
 * (atacar lo material primero), **selección múltiple + clasificar en lote**, y la
 * **sugerencia con nivel de confianza** por fila (confirmar en vez de elegir desde
 * cero). El bulk-classify y el dato de sugerencia por-movimiento requieren backend. */

const BADGE: Record<Tone, "success" | "warning" | "danger" | "default"> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  neutral: "default",
};

export interface ClasificarV2Data {
  total_movements: number;
  items: UnclassifiedMovement[];
}

export function ClasificarV2View({ data }: { data: ClasificarV2Data }) {
  const items = React.useMemo(() => sortByAmountDesc(data.items), [data.items]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const pending = items.length;
  const pendingAmount = totalPending(items);
  const pct = classifiedPct(data.total_movements, pending);

  const allSelected = items.length > 0 && selected.size === items.length;
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)));
  }
  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-neutral-dark">Por clasificar</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Clasifica tus movimientos para que los reportes de gestión estén completos.
        </p>
      </div>

      {/* Progreso */}
      <QavanteCard variant="bordered">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-neutral-dark">
            Quedan <span className="font-semibold">{pending}</span> por clasificar ·{" "}
            <span className="font-semibold tabular-nums">{formatClp(pendingAmount)}</span> sin clasificar
          </span>
          <span className="font-medium text-neutral-mid">
            {pct.toLocaleString("es-CL", { maximumFractionDigits: 0 })}% clasificado
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-light/40">
          <div className="h-full rounded-full bg-success-500" style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      </QavanteCard>

      {/* Barra de acción en lote */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-primary/40 bg-brand-primary/5 p-3 text-sm">
          <span className="font-medium text-neutral-dark">
            {selected.size} {selected.size === 1 ? "movimiento seleccionado" : "movimientos seleccionados"}
          </span>
          <div className="flex items-center gap-2">
            <QavanteButton size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Deseleccionar
            </QavanteButton>
            <QavanteButton size="sm">
              <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
              Clasificar {selected.size} juntos
            </QavanteButton>
          </div>
        </div>
      )}

      {/* Tabla */}
      <QavanteCard variant="bordered" className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm [&_td]:border-r [&_td]:border-border/50 [&_th]:border-r [&_th]:border-border/50 [&_td:last-child]:border-r-0 [&_th:last-child]:border-r-0">
            <thead>
              <tr className="border-b border-border-strong text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
                <th scope="col" className="py-2.5 pl-4 pr-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Seleccionar todos"
                    className="h-4 w-4 rounded border-border accent-brand-primary"
                  />
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">Movimiento</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Fecha</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">Monto</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Sugerencia de Qavante</th>
                <th scope="col" className="py-2 pr-4" aria-label="Acción" />
              </tr>
            </thead>
            <tbody>
              {items.map((m) => {
                const amt = parseAmount(m.amount);
                const isSel = selected.has(m.id);
                const cTone = confidenceTone(m.confidence);
                return (
                  <tr key={m.id} className={cn("border-b border-border/60 last:border-b-0 hover:bg-surface-muted", isSel && "bg-brand-primary/5")}>
                    <td className="py-1.5 pl-4 pr-2">
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggle(m.id)}
                        aria-label={`Seleccionar ${m.glosa}`}
                        className="h-4 w-4 rounded border-border accent-brand-primary"
                      />
                    </td>
                    <td className="py-1.5 pr-3">
                      <span className="block truncate font-medium text-neutral-dark">{m.glosa}</span>
                    </td>
                    <td className="whitespace-nowrap py-1.5 pr-3 text-neutral-mid">{formatDateLike(m.date)}</td>
                    <td className={cn("whitespace-nowrap py-1.5 pr-3 text-right tabular-nums font-medium", amt < 0 ? "text-danger-500" : "text-success-700")}>
                      {amt < 0 ? "−" : "+"}
                      {formatClp(Math.abs(amt))}
                    </td>
                    <td className="py-1.5 pr-3">
                      {m.suggested_account ? (
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-brand-primary" aria-hidden="true" />
                          <span className="text-neutral-dark">{m.suggested_account}</span>
                          <QavanteBadge variant={BADGE[cTone]}>{confidencePct(m.confidence)}</QavanteBadge>
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-mid">Sin sugerencia</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-4 text-right">
                      <QavanteButton size="sm" variant={m.suggested_account ? "secondary" : "ghost"}>
                        {m.suggested_account ? "Confirmar" : "Clasificar"}
                      </QavanteButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </QavanteCard>

      <p className="text-xs text-neutral-mid">
        Con sugerencia, clasificar es <span className="font-medium">confirmar</span> en vez de elegir desde cero.
        Selecciona varios movimientos similares y clasifícalos en lote.
      </p>
    </div>
  );
}
