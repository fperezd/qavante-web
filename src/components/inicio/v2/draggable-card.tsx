"use client";

import * as React from "react";
import { GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/* Envoltorio interactivo de una tarjeta del grid del Inicio v2. El dueño la reordena de dos formas:
   - ARRASTRANDO el asa (Pointer Events → funciona con mouse Y con el dedo en el celular; el DnD nativo
     HTML5 no anda en touch, por eso NO lo usamos).
   - Con los botones ↑/↓ (teclado + toque simple; siempre disponibles como alternativa accesible).

   Las asas están SIEMPRE VISIBLES (atenuadas, se resaltan al hover/foco) para que se note que la tarjeta
   se puede mover — antes estaban ocultas hasta el hover y "no se veía" que fueran movibles.

   Presentacional: NO conoce persistencia; reporta `onMove(from, to)` con índices. La vista live decide el
   orden efectivo y lo persiste en `/api/me/preferences`. El asa lleva `data-widget-index`/`touch-action:
   none` para que arrastrar no scrollee la página, y durante el arrastre la tarjeta se vuelve
   `pointer-events:none` para que `elementFromPoint` encuentre la tarjeta de ABAJO (el destino del drop). */

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
  const [dragging, setDragging] = React.useState(false);
  const isFirst = index === 0;
  const isLast = index === count - 1;

  // Índice de la tarjeta bajo el puntero (destino), leído del `data-widget-index` vía elementFromPoint.
  const targetIndex = (clientX: number, clientY: number): number | null => {
    const el = document.elementFromPoint(clientX, clientY);
    const card = el?.closest<HTMLElement>("[data-widget-index]");
    if (!card) return null;
    const n = Number(card.dataset.widgetIndex);
    return Number.isNaN(n) ? null : n;
  };

  const startDrag = (e: React.PointerEvent) => {
    // Solo botón principal / toque; no arrancamos con click derecho.
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    setDragging(true);

    const onPointerUp = (ev: PointerEvent) => {
      const to = targetIndex(ev.clientX, ev.clientY);
      setDragging(false);
      document.removeEventListener("pointerup", onPointerUp);
      if (to != null && to !== index) onMove(index, to);
    };
    document.addEventListener("pointerup", onPointerUp);
  };

  return (
    <div
      data-widget-index={index}
      className={cn(
        "group/card relative rounded-xl transition-shadow",
        // Durante el arrastre: se "levanta" y deja pasar el puntero para detectar la tarjeta de abajo.
        dragging && "pointer-events-none scale-[0.99] opacity-70 shadow-lg",
        className,
      )}
    >
      <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-lg bg-surface/80 p-0.5 opacity-60 shadow-sm backdrop-blur transition-opacity group-hover/card:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          aria-label={`Arrastrar “${label}” para moverla`}
          onPointerDown={startDrag}
          style={{ touchAction: "none" }}
          className="cursor-grab touch-none rounded p-1 text-neutral-mid hover:bg-surface-muted hover:text-neutral-dark active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
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
