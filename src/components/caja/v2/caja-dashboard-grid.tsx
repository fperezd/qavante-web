"use client";

import * as React from "react";
import { usePreferences, useUpdatePreferences } from "@/lib/api/preferences";
import { applyWidgetOrder, readWidgetOrder, withWidgetOrder } from "@/components/inicio/v2/widget-order";
import {
  applyVisibility,
  readHidden,
  toggleHidden,
  withHidden,
} from "@/components/inicio/v2/widget-visibility";
import {
  SortableWidgetGrid,
  type SortableWidgetItem,
} from "@/components/inicio/v2/sortable-widget-grid";

/* Landing de Caja REORDENABLE (piloto `cajaDashboard`). Reusa el motor del Inicio (SortableWidgetGrid),
   pero en UNA columna: las secciones de Caja son anchas (hero/medidor, saldos, menú de movimientos,
   proyectada), no calzan en 2-col. Orden/visibilidad en prefs bajo llaves PROPIAS de Caja (no pisan al
   Inicio ni a Gestión). Persiste solo si el GET de prefs tuvo éxito (el PUT reemplaza el blob). */

const CAJA_ORDER_KEY = "caja_widget_order";
const CAJA_HIDDEN_KEY = "caja_widget_hidden";

export function CajaDashboardGrid({ items }: { items: SortableWidgetItem[] }) {
  const prefs = usePreferences();
  const updatePrefs = useUpdatePreferences();
  const [localOrder, setLocalOrder] = React.useState<string[] | null>(null);
  const [localHidden, setLocalHidden] = React.useState<string[] | null>(null);

  const savedOrder = readWidgetOrder(prefs.data?.preferences, CAJA_ORDER_KEY);
  const savedHidden = readHidden(prefs.data?.preferences, CAJA_HIDDEN_KEY);
  const effectiveHidden = localHidden ?? savedHidden;

  const visible = applyVisibility(items, effectiveHidden);
  const ordered = applyWidgetOrder(visible, localOrder ?? savedOrder);

  const reorderIds = (nextIds: string[]) => {
    setLocalOrder(nextIds);
    if (prefs.isSuccess) {
      updatePrefs.mutate(withWidgetOrder(prefs.data?.preferences, nextIds, CAJA_ORDER_KEY));
    }
  };

  const hide = (id: string) => {
    const next = toggleHidden(effectiveHidden, id);
    setLocalHidden(next);
    if (prefs.isSuccess) {
      updatePrefs.mutate(withHidden(prefs.data?.preferences, next, CAJA_HIDDEN_KEY));
    }
  };

  // Re-mostrar TODO lo oculto (sin panel Personalizar acá → sin esto, ocultar sería sin retorno).
  const mostrarTodo = () => {
    setLocalHidden([]);
    if (prefs.isSuccess) {
      updatePrefs.mutate(withHidden(prefs.data?.preferences, [], CAJA_HIDDEN_KEY));
    }
  };

  return (
    <div className="space-y-3">
      <SortableWidgetGrid
        items={ordered}
        onReorder={reorderIds}
        onHide={hide}
        gridClassName="grid gap-4"
      />
      {effectiveHidden.length > 0 && (
        <button
          type="button"
          onClick={mostrarTodo}
          className="text-sm font-medium text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          Mostrar {effectiveHidden.length} oculta{effectiveHidden.length > 1 ? "s" : ""} ↺
        </button>
      )}
    </div>
  );
}
