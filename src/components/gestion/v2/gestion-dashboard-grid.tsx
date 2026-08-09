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

/* Tablero REORDENABLE de Gestión (piloto `gestionDashboard`). Reusa el motor del Inicio: las secciones
   entran como `{id,label,node}` y se muestran con `SortableWidgetGrid` (arrastrar + x + reflow iPad). El
   orden/visibilidad se persisten en el blob de prefs bajo llaves PROPIAS de Gestión (no pisan al Inicio).
   Optimista local hasta el primer cambio; persiste solo si el GET de prefs tuvo éxito (el PUT reemplaza el
   blob → escribir sobre un GET fallido pisaría el resto de prefs). */

const GESTION_ORDER_KEY = "gestion_widget_order";
const GESTION_HIDDEN_KEY = "gestion_widget_hidden";

export function GestionDashboardGrid({ items }: { items: SortableWidgetItem[] }) {
  const prefs = usePreferences();
  const updatePrefs = useUpdatePreferences();
  const [localOrder, setLocalOrder] = React.useState<string[] | null>(null);
  const [localHidden, setLocalHidden] = React.useState<string[] | null>(null);

  const savedOrder = readWidgetOrder(prefs.data?.preferences, GESTION_ORDER_KEY);
  const savedHidden = readHidden(prefs.data?.preferences, GESTION_HIDDEN_KEY);
  const effectiveHidden = localHidden ?? savedHidden;

  const visible = applyVisibility(items, effectiveHidden);
  const ordered = applyWidgetOrder(visible, localOrder ?? savedOrder);

  const reorderIds = (nextIds: string[]) => {
    setLocalOrder(nextIds);
    if (prefs.isSuccess) {
      updatePrefs.mutate(withWidgetOrder(prefs.data?.preferences, nextIds, GESTION_ORDER_KEY));
    }
  };

  const hide = (id: string) => {
    const next = toggleHidden(effectiveHidden, id);
    setLocalHidden(next);
    if (prefs.isSuccess) {
      updatePrefs.mutate(withHidden(prefs.data?.preferences, next, GESTION_HIDDEN_KEY));
    }
  };

  return <SortableWidgetGrid items={ordered} onReorder={reorderIds} onHide={hide} />;
}
