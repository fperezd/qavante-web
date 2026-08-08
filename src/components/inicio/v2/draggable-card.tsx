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

   Mientras se arrastra, la tarjeta DESTINO (sobre la que se va a soltar) se resalta con un anillo en
   tiempo real: marcamos `data-drop-target` en su nodo (vía `elementFromPoint` en cada `pointermove`) y
   Tailwind lo estiliza. La tarjeta arrastrada se vuelve `pointer-events:none` para que `elementFromPoint`
   encuentre la de ABAJO. Presentacional: NO conoce persistencia; reporta `onMove(from, to)` con índices;
   la vista live decide el orden efectivo y lo persiste en `/api/me/preferences`. */

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
  // Última tarjeta resaltada como destino (para limpiarle el `data-drop-target` al cambiar/soltar).
  const lastTarget = React.useRef<HTMLElement | null>(null);

  /** Tarjeta bajo el puntero (destino), leída del `data-widget-index` vía elementFromPoint. */
  const cardUnder = (clientX: number, clientY: number): HTMLElement | null => {
    const el = document.elementFromPoint(clientX, clientY);
    return el?.closest<HTMLElement>("[data-widget-index]") ?? null;
  };

  const clearTarget = () => {
    if (lastTarget.current) {
      delete lastTarget.current.dataset.dropTarget;
      lastTarget.current = null;
    }
  };

  const startDrag = (e: React.PointerEvent) => {
    if (e.button != null && e.button !== 0) return; // solo principal / toque
    e.preventDefault();
    setDragging(true);

    const handleMove = (ev: PointerEvent) => {
      const card = cardUnder(ev.clientX, ev.clientY);
      // Resaltar el destino solo si es OTRA tarjeta (no la que arrastramos).
      if (card && Number(card.dataset.widgetIndex) !== index) {
        if (lastTarget.current !== card) {
          clearTarget();
          card.dataset.dropTarget = "true";
          lastTarget.current = card;
        }
      } else {
        clearTarget();
      }
    };

    const handleUp = (ev: PointerEvent) => {
      const card = cardUnder(ev.clientX, ev.clientY);
      const to = card ? Number(card.dataset.widgetIndex) : NaN;
      clearTarget();
      setDragging(false);
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      if (!Number.isNaN(to) && to !== index) onMove(index, to);
    };

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
  };

  // Limpieza defensiva si el componente se desmonta a mitad de un arrastre.
  React.useEffect(() => () => clearTarget(), []);

  return (
    <div
      data-widget-index={index}
      className={cn(
        "group/card relative rounded-xl transition-shadow",
        // Destino del drop: anillo en tiempo real (Tailwind lee el data-attr que seteamos al arrastrar).
        "data-[drop-target=true]:ring-2 data-[drop-target=true]:ring-primary/70 data-[drop-target=true]:ring-offset-2",
        // La tarjeta arrastrada se "levanta" y deja pasar el puntero para detectar la de abajo.
        dragging && "pointer-events-none scale-[0.99] opacity-70 shadow-lg",
        className,
      )}
    >
      <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-lg bg-surface/80 p-0.5 opacity-60 shadow-sm backdrop-blur transition-opacity group-hover/card:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          aria-label={`Arrastrar “${label}” para reordenar`}
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
