"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type Header,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, GripVertical, SlidersHorizontal } from "lucide-react";
import { cn } from "../lib/cn";
import { Collapsible } from "./collapsible";
import { moveColumn } from "./data-table-utils";

/* DataTable — sobre TanStack Table: ordenamiento, mostrar/ocultar columnas y
   reordenar columnas por drag & drop. Cada columna DEBE tener `id`. */

export interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  className?: string;
  enableReorder?: boolean;
  enableColumnToggle?: boolean;
}

function DraggableHeader<TData>({
  header,
  enableReorder,
}: {
  header: Header<TData, unknown>;
  enableReorder: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: header.column.id,
    disabled: !enableReorder,
  });
  const canSort = header.column.getCanSort();
  const sorted = header.column.getIsSorted();

  return (
    <th
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "sticky top-0 z-10 whitespace-nowrap bg-surface-muted px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-mid",
        isDragging && "opacity-60",
      )}
    >
      <div className="flex items-center gap-1.5">
        {enableReorder && (
          <button
            type="button"
            className="cursor-grab touch-none text-neutral-light hover:text-neutral-mid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary active:cursor-grabbing"
            aria-label={`Reordenar columna ${header.column.id}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
          className={cn(
            "inline-flex items-center gap-1",
            canSort && "hover:text-neutral-dark",
            !canSort && "cursor-default",
          )}
          aria-label={canSort ? "Ordenar" : undefined}
        >
          {flexRender(header.column.columnDef.header, header.getContext())}
          {canSort &&
            (sorted === "asc" ? (
              <ArrowUp className="h-3 w-3" aria-hidden="true" />
            ) : sorted === "desc" ? (
              <ArrowDown className="h-3 w-3" aria-hidden="true" />
            ) : (
              <ChevronsUpDown className="h-3 w-3 opacity-50" aria-hidden="true" />
            ))}
        </button>
      </div>
    </th>
  );
}

export function DataTable<TData>({
  data,
  columns,
  className,
  enableReorder = true,
  enableColumnToggle = true,
}: DataTableProps<TData>) {
  const columnIds = React.useMemo(
    () => columns.map((c) => c.id).filter((id): id is string => id !== undefined),
    [columns],
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = React.useState<string[]>(columnIds);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, columnOrder },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setColumnOrder((order) => moveColumn(order, String(active.id), String(over.id)));
  };

  return (
    <div className={cn("space-y-3", className)}>
      {enableColumnToggle && (
        <Collapsible
          title={
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-neutral-mid" aria-hidden="true" />
              Columnas
            </span>
          }
        >
          <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
            {table.getAllLeafColumns().map((column) => (
              <label
                key={column.id}
                className="inline-flex cursor-pointer items-center gap-2 text-sm text-neutral-dark"
              >
                <input
                  type="checkbox"
                  checked={column.getIsVisible()}
                  onChange={column.getToggleVisibilityHandler()}
                  className="h-4 w-4 rounded border-border accent-brand-primary"
                />
                {column.id}
              </label>
            ))}
          </div>
        </Collapsible>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <table className="w-full border-collapse text-sm">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                    {headerGroup.headers.map((header) => (
                      <DraggableHeader
                        key={header.id}
                        header={header}
                        enableReorder={enableReorder}
                      />
                    ))}
                  </SortableContext>
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-border transition-colors hover:bg-brand-primary-50/30"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="whitespace-nowrap px-3 py-2.5 text-neutral-dark">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </DndContext>
      </div>
    </div>
  );
}
