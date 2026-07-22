"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { DraggableCard } from "@/components/inicio/v2/draggable-card";
import { moveItem } from "@/components/inicio/v2/widget-order";

/* CajaV2Resumen — shell de composición de la pestaña "Resumen" del Caja v2 (rediseño
   2026-07-14). Baranda: el hero (saldo + runway + bancos + flujo) y la curva quedan
   FIJOS arriba (el mensaje no se mueve). Debajo, las cajas secundarias son MOVIBLES: el
   usuario las reordena (mismo mecanismo del Inicio — DraggableCard, mouse + teclado). En
   vivo el orden se persiste por empresa en `/api/me/preferences`. Presentacional: recibe
   las piezas como slots. */

export interface CajaMovible {
  id: string;
  /** Etiqueta accesible (para el asa de arrastre). */
  label: string;
  node: React.ReactNode;
}

export interface CajaV2ResumenProps {
  /** <CajaHero/> — la respuesta de dueño (fija). */
  hero: React.ReactNode;
  /** <SaldoPorBanco/> (fijo). `null` lo oculta — en Caja v3 el saldo ya vive en el hero, así que
   *  "Saldo disponible · Total en caja hoy" repetía el mismo número; sin él la baranda va a 2 cols. */
  bancos?: React.ReactNode;
  /** Bloque de flujo del período (entra/sale/neto/mínima) (fijo). */
  flujo: React.ReactNode;
  /** La curva de saldo, ya envuelta con su encabezado/leyenda (fija). */
  curva: React.ReactNode;
  /** Selector de período (rango), renderizado JUSTO ANTES de las cajas movibles ("Entradas y salidas
   *  · por período" es la tabla que gobierna). El medidor/cascada de arriba son a futuro (no dependen
   *  del rango) → el selector vive con lo que sí controla. `null` lo omite. */
  periodoSelector?: React.ReactNode;
  /** Cajas secundarias reordenables. */
  movibles: CajaMovible[];
  className?: string;
}

export function CajaV2Resumen({
  hero,
  bancos,
  flujo,
  curva,
  periodoSelector,
  movibles,
  className,
}: CajaV2ResumenProps) {
  const [order, setOrder] = React.useState<string[]>(() => movibles.map((m) => m.id));

  // Orden efectivo, robusto ante cambios en `movibles` (ids nuevos van al final).
  const ordered = React.useMemo(() => {
    const byId = new Map(movibles.map((m) => [m.id, m]));
    const inOrder = order.map((id) => byId.get(id)).filter(Boolean) as CajaMovible[];
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
      {/* Baranda: hero + (bancos) + flujo (fijo). Sin bancos (Caja v3) → 2 columnas. */}
      <div
        className={cn(
          "grid items-stretch gap-px overflow-hidden rounded-xl border border-border bg-border shadow-sm sm:grid-cols-2",
          bancos != null && "lg:grid-cols-[1fr_1fr_0.9fr]",
        )}
      >
        <div className="bg-surface">{hero}</div>
        {bancos != null && <div className="bg-surface">{bancos}</div>}
        <div className="bg-surface">{flujo}</div>
      </div>

      {/* Baranda: la curva (fija) */}
      {curva}

      {/* Selector de período — vive con la tabla que gobierna, no arriba (el medidor/cascada son a futuro). */}
      {periodoSelector != null && periodoSelector}

      {/* Cajas movibles — a 2 columnas solo si hay ≥2; con una sola, ancho completo (sin vacío). */}
      <div className={cn("grid items-start gap-4", ordered.length >= 2 && "md:grid-cols-2")}>
        {ordered.map((m, i) =>
          reorderable ? (
            <DraggableCard
              key={m.id}
              label={m.label}
              index={i}
              count={ordered.length}
              onMove={reorder}
            >
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
