"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

/* Grilla de tarjetas del Inicio con reordenamiento estilo iPad: al arrastrar una card, las demás se
   CORREN solas para abrir el hueco donde va a caer (reflow animado, `rectSortingStrategy`) y la card
   arrastrada FLOTA siguiendo el dedo (`DragOverlay`). Funciona con mouse, dedo (long-press) y teclado
   (foco en el asa → Espacio para levantar, flechas para mover, Espacio para soltar — @dnd-kit lo maneja).
   El asa (grip) es SIEMPRE visible para que se note que la card se mueve; el resto de la card queda
   clickeable (los listeners de arrastre viven solo en el asa). Persiste vía `onReorder(ids)`. */

export interface SortableWidgetItem {
  id: string;
  label: string;
  node: React.ReactNode;
}

export interface SortableWidgetGridProps {
  items: SortableWidgetItem[];
  /** Nuevo orden de ids tras soltar (la vista live lo persiste en prefs). */
  onReorder: (ids: string[]) => void;
}

export function SortableWidgetGrid({ items, onReorder }: SortableWidgetGridProps) {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const ids = React.useMemo(() => items.map((i) => i.id), [items]);

  const sensors = useSensors(
    // Mouse: arranca al mover 6px (así los clicks dentro de la card no disparan drag).
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Touch: long-press 200ms para levantar (deja hacer scroll con toques normales).
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    onReorder(arrayMove(ids, from, to));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className="grid gap-3.5 sm:grid-cols-2">
          {items.map((item) => (
            <SortableCard key={item.id} id={item.id} label={item.label}>
              {item.node}
            </SortableCard>
          ))}
        </div>
      </SortableContext>

      {/* La card que se arrastra, flotando bajo el dedo (efecto "la levantaste"). */}
      <DragOverlay>
        {activeItem ? (
          <div className="scale-[1.03] rounded-xl opacity-95 shadow-2xl ring-2 ring-primary/40">
            {activeItem.node}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function SortableCard({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group/card relative rounded-xl",
        // El slot original queda como "hueco" mientras la card flota en el overlay.
        isDragging && "opacity-30",
      )}
    >
      <button
        type="button"
        aria-label={`Arrastrar “${label}” para reordenar`}
        {...attributes}
        {...listeners}
        style={{ touchAction: "none" }}
        className="absolute right-2 top-2 z-10 cursor-grab touch-none rounded-lg bg-surface/80 p-1 text-neutral-mid opacity-60 shadow-sm backdrop-blur transition-opacity hover:text-neutral-dark active:cursor-grabbing group-hover/card:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      {children}
    </div>
  );
}
