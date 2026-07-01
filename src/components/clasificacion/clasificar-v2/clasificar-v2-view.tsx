"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Sparkles, Wand2 } from "lucide-react";
import { QavanteBadge, QavanteButton, QavanteCard } from "@/components/qavante";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import { cn } from "@/lib/utils";
import { DynamicTable } from "@/components/proposals/dynamic-table/dynamic-table";
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

  const columns = React.useMemo<ColumnDef<UnclassifiedMovement>[]>(
    () => [
      {
        id: "select",
        enableSorting: false,
        enableColumnFilter: false,
        header: () => (
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            aria-label="Seleccionar todos"
            className="h-4 w-4 rounded border-border accent-brand-primary"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selected.has(row.original.id)}
            onChange={() => toggle(row.original.id)}
            aria-label={`Seleccionar ${row.original.glosa}`}
            className="h-4 w-4 rounded border-border accent-brand-primary"
          />
        ),
      },
      {
        id: "movimiento",
        accessorKey: "glosa",
        header: "Movimiento",
        cell: ({ getValue }) => (
          <span className="block truncate font-medium text-neutral-dark">{getValue() as string}</span>
        ),
      },
      {
        id: "fecha",
        accessorKey: "date",
        header: "Fecha",
        enableColumnFilter: false,
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap text-neutral-mid">{formatDateLike(getValue() as string)}</span>
        ),
      },
      {
        id: "monto",
        accessorFn: (m) => parseAmount(m.amount),
        header: "Monto",
        enableColumnFilter: false,
        meta: { align: "right" },
        cell: ({ getValue }) => {
          const amt = getValue() as number;
          return (
            <span className={cn("whitespace-nowrap font-medium", amt < 0 ? "text-danger-500" : "text-success-700")}>
              {amt < 0 ? "−" : "+"}
              {formatClp(Math.abs(amt))}
            </span>
          );
        },
      },
      {
        id: "sugerencia",
        accessorKey: "suggested_account",
        header: "Sugerencia de Qavante",
        cell: ({ row }) => {
          const m = row.original;
          return m.suggested_account ? (
            <span className="inline-flex flex-wrap items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-brand-primary" aria-hidden="true" />
              <span className="text-neutral-dark">{m.suggested_account}</span>
              <QavanteBadge variant={BADGE[confidenceTone(m.confidence)]}>{confidencePct(m.confidence)}</QavanteBadge>
            </span>
          ) : (
            <span className="text-xs text-neutral-mid">Sin sugerencia</span>
          );
        },
      },
      {
        id: "accion",
        header: "",
        enableSorting: false,
        enableColumnFilter: false,
        meta: { align: "right" },
        cell: ({ row }) => (
          <QavanteButton size="sm" variant={row.original.suggested_account ? "secondary" : "ghost"}>
            {row.original.suggested_account ? "Confirmar" : "Clasificar"}
          </QavanteButton>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, allSelected],
  );

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

      {/* Tabla dinámica: ordenar / filtrar / mover columnas */}
      <DynamicTable
        columns={columns as ColumnDef<UnclassifiedMovement, unknown>[]}
        data={items}
        minWidth={720}
        rowClassName={(m) => (selected.has(m.id) ? "bg-brand-primary/5" : undefined)}
      />

      <p className="text-xs text-neutral-mid">
        Con sugerencia, clasificar es <span className="font-medium">confirmar</span> en vez de elegir desde cero.
        Selecciona varios movimientos similares y clasifícalos en lote.
      </p>
    </div>
  );
}
