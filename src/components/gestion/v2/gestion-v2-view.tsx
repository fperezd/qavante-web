"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { DraggableCard } from "@/components/inicio/v2/draggable-card";
import { moveItem } from "@/components/inicio/v2/widget-order";

/* GestionV2View — shell de composición de Gestión v2 (Resultado Operacional del mes). Baranda
   FIJA arriba: la respuesta de dueño (resultado + márgenes + comparativos del ritmo) y la
   cascada del resultado — el mensaje y su explicación visual no se mueven. Debajo, las cajas
   secundarias (qué explica el resultado, Pulso) son MOVIBLES (mismo mecanismo del Inicio —
   DraggableCard). El selector de tiempo y el sello "no es contabilidad oficial" los pone la
   página. Presentacional (slots). */

export interface GestionMovible {
  id: string;
  label: string;
  node: React.ReactNode;
}

export interface GestionV2ViewProps {
  /** <ResultadoHero/> (fijo). */
  hero: React.ReactNode;
  /** Bloque de márgenes (bruto / operacional / EBITDA) (fijo). */
  margenes: React.ReactNode;
  /** Comparativos del ritmo (vs mes / vs año / vs promedio) (fijo). */
  comparativos: React.ReactNode;
  /** <CascadaResultado/> (fijo, destacado). */
  cascada: React.ReactNode;
  /** Cajas secundarias reordenables (drivers, Pulso). */
  movibles: GestionMovible[];
  className?: string;
}

export function GestionV2View({ hero, margenes, comparativos, cascada, movibles, className }: GestionV2ViewProps) {
  const [order, setOrder] = React.useState<string[]>(() => movibles.map((m) => m.id));

  const ordered = React.useMemo(() => {
    const byId = new Map(movibles.map((m) => [m.id, m]));
    const inOrder = order.map((id) => byId.get(id)).filter(Boolean) as GestionMovible[];
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
      {/* Baranda: respuesta de dueño (resultado + márgenes + comparativos) */}
      <div className="grid items-stretch gap-px overflow-hidden rounded-xl border border-border bg-border shadow-sm sm:grid-cols-2 lg:grid-cols-[1.15fr_1fr_1fr]">
        <div className="bg-surface">{hero}</div>
        <div className="bg-surface">{margenes}</div>
        <div className="bg-surface">{comparativos}</div>
      </div>

      {/* Baranda: la cascada del resultado (destacada) */}
      {cascada}

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
