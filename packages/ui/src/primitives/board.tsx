"use client";

import * as React from "react";
import {
  DndContext,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "../lib/cn";
import { type BoardItem, type BoardState, moveItem, findColumnOf } from "./board-state";

/* Board — tablero tipo Kanban con drag & drop entre columnas. Controlado: recibe
   `columns` y notifica `onColumnsChange`. Lógica en board-state.ts (testeada). */

export interface BoardProps<T extends BoardItem> {
  columns: BoardState<T>;
  onColumnsChange: (next: BoardState<T>) => void;
  renderCard: (item: T) => React.ReactNode;
  className?: string;
}

function Card<T extends BoardItem>({
  item,
  render,
}: {
  item: T;
  render: (i: T) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-start gap-2 rounded-lg border border-border bg-surface p-3 shadow-sm",
        isDragging && "opacity-50",
      )}
    >
      <button
        type="button"
        className="mt-0.5 cursor-grab touch-none text-neutral-mid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary active:cursor-grabbing"
        aria-label="Mover tarjeta"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      <div className="min-w-0 flex-1">{render(item)}</div>
    </div>
  );
}

function Column<T extends BoardItem>({
  column,
  render,
}: {
  column: BoardState<T>[number];
  render: (i: T) => React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl bg-surface-muted">
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
          {column.title}
        </span>
        <span className="rounded-full bg-neutral-light/40 px-2 text-xs font-medium text-neutral-mid tabular-nums">
          {column.items.length}
        </span>
      </div>
      <SortableContext items={column.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            "flex min-h-24 flex-1 flex-col gap-2 rounded-lg p-2 transition-colors",
            isOver && "bg-brand-primary-50/60",
          )}
        >
          {column.items.map((item) => (
            <Card key={item.id} item={item} render={render} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export function Board<T extends BoardItem>({
  columns,
  onColumnsChange,
  renderCard,
  className,
}: BoardProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    const toColumnId =
      findColumnOf(columns, overId) ?? (columns.some((c) => c.id === overId) ? overId : undefined);
    if (toColumnId === undefined) return;

    const overColumn = columns.find((c) => c.id === toColumnId);
    const overIdx = overColumn ? overColumn.items.findIndex((i) => i.id === overId) : -1;
    const toIndex = overIdx >= 0 ? overIdx : undefined;

    const next = moveItem(columns, activeId, toColumnId, toIndex);
    if (next !== columns) onColumnsChange(next);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
      <div className={cn("flex gap-4 overflow-x-auto pb-2", className)}>
        {columns.map((column) => (
          <Column key={column.id} column={column} render={renderCard} />
        ))}
      </div>
    </DndContext>
  );
}
