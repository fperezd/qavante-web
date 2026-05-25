"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { formatClp } from "@/lib/formatters/clp";
import { formatDate } from "@/lib/formatters/date";
import type { BankMovement } from "@/lib/api/treasury";
import { ClasificadosStatCard, type StatCardTone } from "./clasificados-stat-card";
import {
  buildClasificadosStats,
  type AccountLookupItem,
  type CategoryLookupItem,
} from "./build-clasificados-stats";

/* Bloque "Resumen de movimientos clasificados" en /caja/clasificados.
 *
 * Diseñado para vivir arriba de la tabla. Recibe los items que actualmente
 * alimentan la tabla + lookups (categorías / cuentas de gestión) y deriva
 * todas las métricas vía `buildClasificadosStats`. NO hace fetches propios:
 * la fuente de verdad es el hook `useBankMovements` del view padre.
 *
 * Cards accionables (las que el view ya soporta filtrar):
 *  - Ingresos clasificados   → direction = "credit"
 *  - Egresos clasificados    → direction = "debit"
 *  - Tipo más frecuente      → canonical_category = code
 *
 * Info-only en este PR (no inventamos interacciones que el view no soporta;
 * los filtros faltantes se agregan en PR siguiente):
 *  - Movimientos clasificados (no hace sentido filtrar a sí mismo)
 *  - Neto clasificado          (no hace sentido filtrar)
 *  - Requieren revisión        (falta filtro `needs_review` en el view)
 *  - Categoría principal       (falta filtro `management_account_id` en el view)
 *  - Última clasificación      (referencia temporal, no es filtro)
 *
 * Métrica omitida en este PR (brecha backend documentada en el plan):
 *  - "Clasificación completa" (%) — requeriría endpoint de stats backend o
 *    una segunda query al universo unclassified del mismo período. Se deja
 *    para PR siguiente. */

export interface ClasificadosStatsProps {
  items: BankMovement[];
  /** El caller (view) detectó que el universo server-side del filtro actual
   *  excede los items descargados (`query.data.total > allItems.length`).
   *  El bloque muestra aviso de alcance parcial. */
  isPartial: boolean;
  categoriesById: Map<string, CategoryLookupItem>;
  accountsById: Map<string, AccountLookupItem>;
  /** Loading inicial — pintamos skeleton. Cuando ya hay datos cargados,
   *  un refetch en background no debe re-mostrar skeleton. */
  isLoading?: boolean;
  /** Callbacks opcionales: si no se proveen, esas cards se renderizan como
   *  info-only (sin afford de click). */
  onApplyDirectionFilter?: (direction: "credit" | "debit") => void;
  onApplyCanonicalCategoryFilter?: (code: string) => void;
}

export function ClasificadosStats({
  items,
  isPartial,
  categoriesById,
  accountsById,
  isLoading = false,
  onApplyDirectionFilter,
  onApplyCanonicalCategoryFilter,
}: ClasificadosStatsProps) {
  const stats = React.useMemo(
    () => buildClasificadosStats({ items, isPartial, categoriesById, accountsById }),
    [items, isPartial, categoriesById, accountsById],
  );

  if (isLoading && items.length === 0) {
    return <StatsSkeleton />;
  }

  if (stats.count === 0) {
    return (
      <QavanteCard variant="bordered">
        <p className="text-sm text-neutral-mid">
          No hay movimientos clasificados para los filtros seleccionados.
        </p>
      </QavanteCard>
    );
  }

  const netTone: StatCardTone = stats.netAmount >= 0 ? "success" : "warning";
  const needsReviewTone: StatCardTone = stats.needsReviewCount > 0 ? "warning" : "neutral";

  return (
    <section aria-label="Resumen de movimientos clasificados" className="space-y-3">
      {stats.dataStatus === "partial" && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-warning-500/30 bg-warning-500/10 px-3 py-2 text-xs text-warning-700"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            Estas estadísticas corresponden a los movimientos visibles. El período seleccionado
            tiene más movimientos clasificados de los que se descargaron; afina el filtro de período
            para ver agregados completos.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ClasificadosStatCard
          label="Movimientos clasificados"
          value={String(stats.count)}
          tooltip="Cantidad total de movimientos clasificados que cumplen los filtros actuales."
        />
        <ClasificadosStatCard
          label="Ingresos clasificados"
          value={formatClp(stats.incomeAmount)}
          tone="success"
          tooltip="Suma de movimientos clasificados con dirección ingreso."
          onClick={onApplyDirectionFilter ? () => onApplyDirectionFilter("credit") : undefined}
          actionLabel="Filtrar solo ingresos"
        />
        <ClasificadosStatCard
          label="Egresos clasificados"
          value={formatClp(stats.expenseAmount)}
          tone="warning"
          tooltip="Suma de movimientos clasificados con dirección egreso."
          onClick={onApplyDirectionFilter ? () => onApplyDirectionFilter("debit") : undefined}
          actionLabel="Filtrar solo egresos"
        />
        <ClasificadosStatCard
          label="Neto clasificado"
          value={formatClp(stats.netAmount)}
          tone={netTone}
          tooltip="Ingresos clasificados menos egresos clasificados."
        />

        <ClasificadosStatCard
          label="Requieren revisión"
          value={String(stats.needsReviewCount)}
          tone={needsReviewTone}
          sublabel={
            stats.needsReviewCount > 0 ? "Confianza baja o estado pendiente" : "Todo en orden"
          }
          tooltip="Movimientos clasificados marcados para revisión por confianza baja o datos inconsistentes."
        />
        {stats.topCanonical && (
          <ClasificadosStatCard
            label="Tipo más frecuente"
            value={stats.topCanonical.label}
            sublabel={
              stats.topCanonical.count === 1
                ? "1 movimiento"
                : `${stats.topCanonical.count} movimientos`
            }
            tooltip="Categoría canónica con más movimientos en los filtros actuales."
            onClick={
              onApplyCanonicalCategoryFilter
                ? () => onApplyCanonicalCategoryFilter(stats.topCanonical!.code)
                : undefined
            }
            actionLabel={`Filtrar por ${stats.topCanonical.label}`}
          />
        )}
        {stats.topAccount && (
          <ClasificadosStatCard
            label="Categoría principal"
            value={stats.topAccount.path}
            sublabel={
              stats.topAccount.count === 1
                ? "1 movimiento"
                : `${stats.topAccount.count} movimientos`
            }
            tooltip="Cuenta de gestión con más movimientos asignados en los filtros actuales."
          />
        )}
        {stats.lastClassifiedAt && (
          <ClasificadosStatCard
            label="Última clasificación"
            value={formatLastClassified(stats.lastClassifiedAt)}
            tooltip="Fecha del movimiento clasificado más reciente."
          />
        )}
      </div>
    </section>
  );
}

function formatLastClassified(iso: string): string {
  /* `classified_at` viene ISO datetime. Mostramos solo la fecha — la hora
   * agrega ruido sin ayudar al usuario en este resumen ejecutivo. */
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return formatDate(d);
}

function StatsSkeleton() {
  /* 8 placeholders del tamaño aproximado de las cards reales. `aria-busy` +
   * `aria-label` para SR; sin texto "Cargando..." (regla del prompt). */
  return (
    <div
      aria-busy="true"
      aria-label="Cargando resumen de movimientos clasificados"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="h-[92px] animate-pulse rounded-lg border border-neutral-light bg-neutral-light/30"
        />
      ))}
    </div>
  );
}
