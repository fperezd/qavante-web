"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { DraggableCard } from "@/components/inicio/v2/draggable-card";
import { moveItem } from "@/components/inicio/v2/widget-order";

/* PagarV2View — shell de composición de Pagar v2 (rediseño aprobado 2026-07-14). Baranda
   FIJA arriba: la respuesta de dueño (hero + brecha + secundarios) y "Las 3 del mes" — el
   mensaje no se mueve. Debajo, las cajas secundarias (vencimientos, mayores compromisos)
   son MOVIBLES: el usuario las reordena (mismo mecanismo del Inicio — DraggableCard; en
   vivo el orden se persiste en `/api/me/preferences`). Presentacional (slots). */

export interface PagarMovible {
  id: string;
  label: string;
  node: React.ReactNode;
}

export interface PagarV2ViewProps {
  /** <PagarHero/> (fijo). */
  hero: React.ReactNode;
  /** <BrechaCaja/> (fijo). */
  brecha: React.ReactNode;
  /** Bloque de secundarios (vencido / próx. 7d / mes / USD) (fijo). */
  secundarios: React.ReactNode;
  /** <FechasClaveMes/> (fijo, destacado). */
  fechasClave: React.ReactNode;
  /** Cajas secundarias reordenables (vencimientos, mayores compromisos). */
  movibles: PagarMovible[];
  className?: string;
}

export function PagarV2View({ hero, brecha, secundarios, fechasClave, movibles, className }: PagarV2ViewProps) {
  const [order, setOrder] = React.useState<string[]>(() => movibles.map((m) => m.id));

  const ordered = React.useMemo(() => {
    const byId = new Map(movibles.map((m) => [m.id, m]));
    const inOrder = order.map((id) => byId.get(id)).filter(Boolean) as PagarMovible[];
    const missing = movibles.filter((m) => !order.includes(m.id));
    return [...inOrder, ...missing];
  }, [order, movibles]);

  const reorder = (from: number, to: number) => {
    const ids = ordered.map((m) => m.id);
    const next = moveItem(ids, from, to);
    if (next !== ids) setOrder(next);
  };
  const reorderable = ordered.length >= 2;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Baranda: respuesta de dueño (hero + brecha + secundarios) */}
      <div className="grid items-stretch gap-px overflow-hidden rounded-xl border border-border bg-border shadow-sm sm:grid-cols-2 lg:grid-cols-[1.05fr_1fr_0.8fr]">
        <div className="bg-surface">{hero}</div>
        <div className="bg-surface">{brecha}</div>
        <div className="bg-surface">{secundarios}</div>
      </div>

      {/* Baranda: las 3 del mes (destacadas) */}
      {fechasClave}

      {/* Cajas movibles */}
      <div className="grid items-start gap-4 md:grid-cols-2">
        {ordered.map((m, i) =>
          reorderable ? (
            <DraggableCard key={m.id} label={m.label} index={i} count={ordered.length} onMove={reorder}>
              {m.node}
            </DraggableCard>
          ) : (
            <React.Fragment key={m.id}>{m.node}</React.Fragment>
          ),
        )}
      </div>
    </div>
  );
}
