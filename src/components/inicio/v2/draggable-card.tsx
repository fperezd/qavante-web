"use client";

import * as React from "react";
import { GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/* Envoltorio interactivo de una tarjeta del grid del Inicio v2. El gerente reordena
   arrastrando el asa (mouse, HTML5 DnD) o con los botones ↑/↓ (teclado — el DnD
   nativo NO es accesible por teclado, así que damos ambos). Presentacional: NO
   conoce persistencia; solo reporta `onMove(from, to)` con índices. La vista live
   decide el orden efectivo y lo persiste en `/api/me/preferences`.

   El asa habilita `draggable` solo mientras se la agarra (mousedown) para no romper
   los clicks/selección dentro de la tarjeta. */

export interface DraggableCardProps {
  /** Etiqueta legible de la tarjeta (para los aria-label de las acciones). */
  label: string;
  index: number;
  count: number;
  /** Reordena de `from` a `to` (índices dentro del grid). */
  onMove: (from: number, to: number) => void;
  children: React.ReactNode;
  className?: string;
}

export function DraggableCard({ label, index, count, onMove, children, className }: DraggableCardProps) {
  const [dragEnabled, setDragEnabled] = React.useState(false);
  const [isOver, setIsOver] = React.useState(false);
  const isFirst = index === 0;
  const isLast = index === count - 1;

  return (
    <div
      draggable={dragEnabled}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", String(index));
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => {
        setDragEnabled(false);
        setIsOver(false);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!isOver) setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        const from = Number(e.dataTransfer.getData("text/plain"));
        if (!Number.isNaN(from)) onMove(from, index);
      }}
      className={cn(
        "group/card relative rounded-xl transition-shadow",
        isOver && "ring-2 ring-primary/40 ring-offset-2",
        className,
      )}
    >
      <div className="pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-lg bg-surface/80 p-0.5 opacity-0 shadow-sm backdrop-blur transition-opacity group-hover/card:pointer-events-auto group-hover/card:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">
        <button
          type="button"
          aria-label={`Arrastrar “${label}” para reordenar`}
          onMouseDown={() => setDragEnabled(true)}
          onMouseUp={() => setDragEnabled(false)}
          onBlur={() => setDragEnabled(false)}
          className="cursor-grab rounded p-1 text-neutral-mid hover:bg-surface-muted hover:text-neutral-dark active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={`Mover “${label}” hacia arriba`}
          disabled={isFirst}
          onClick={() => onMove(index, index - 1)}
          className="rounded p-1 text-neutral-mid hover:bg-surface-muted hover:text-neutral-dark disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <ChevronUp className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={`Mover “${label}” hacia abajo`}
          disabled={isLast}
          onClick={() => onMove(index, index + 1)}
          className="rounded p-1 text-neutral-mid hover:bg-surface-muted hover:text-neutral-dark disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <ChevronDown className="size-4" aria-hidden />
        </button>
      </div>
      {children}
    </div>
  );
}
