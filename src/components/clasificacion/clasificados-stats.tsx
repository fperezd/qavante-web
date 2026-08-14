"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { formatMoney } from "@/lib/formatters/clp";
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
 * Diseño: UN solo container card (consistencia con el resto de la página)
 * con las métricas en grilla interna, sin bordes individuales (evita el
 * antipatrón cards-dentro-de-cards). Separación por espacio, no por línea.
 *
 * Cards accionables con toggle:
 *  - Ingresos    → direction = "credit"   (re-clic limpia)
 *  - Egresos     → direction = "debit"    (re-clic limpia)
 *  - Tipo más frecuente → canonical_category = code (re-clic limpia)
 *
 * Estado muted (opacidad reducida, no clickeable): cuando un filtro hermano
 * vuelve la métrica tautológica.
 *  - Ingresos activo → Egresos y Neto muteados (siempre 0 / == Ingresos).
 *  - Egresos activo  → Ingresos y Neto muteados.
 *
 * Info-only en este PR: Movimientos, Requieren revisión, Categoría principal,
 * Última clasificación (faltan los filtros server-side correspondientes —
 * PR siguiente).
 *
 * Brecha backend documentada: "Clasificación completa" (%) omitida hasta
 * que exista endpoint de stats o segunda query del universo. */

export interface ClasificadosStatsProps {
  items: BankMovement[];
  isPartial: boolean;
  categoriesById: Map<string, CategoryLookupItem>;
  accountsById: Map<string, AccountLookupItem>;
  /** Moneda de los montos. Definida SOLO cuando todos los items comparten una
   *  moneda conocida; si no, va `undefined` y hay que pasar `noTotalReason`. */
  currency?: string;
  /** Motivo por el que NO se puede mostrar un monto único (monedas mezcladas o
   *  moneda desconocida — INV-FX-001). Cuando viene, las métricas de plata
   *  (Ingresos/Egresos/Neto) NO muestran una cifra: mostrarían una suma mezclada
   *  o, peor, un fallback silencioso a CLP. El desglose real por moneda lo pinta
   *  `<MultiCurrencyTotalsBreakdown />` al pie de la tabla. */
  noTotalReason?: string | null;
  isLoading?: boolean;
  activeDirection?: "credit" | "debit" | null;
  activeCanonicalCategory?: string | null;
  /** `null` = limpiar el filtro (toggle desde una card activa). */
  onApplyDirectionFilter?: (direction: "credit" | "debit" | null) => void;
  onApplyCanonicalCategoryFilter?: (code: string | null) => void;
}

export function ClasificadosStats({
  items,
  isPartial,
  categoriesById,
  accountsById,
  currency,
  noTotalReason = null,
  isLoading = false,
  activeDirection = null,
  activeCanonicalCategory = null,
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

  /* Con monedas mezcladas (o moneda desconocida) las métricas de plata no se
     pueden expresar en UN número: se rotulan "Por moneda" y el desglose real va
     al pie de la tabla. Mostrar la suma cruda acá sería mezclar CLP con USD. */
  const canTotal = noTotalReason == null;
  const money = (value: number) => (canTotal ? formatMoney(value, currency) : "Por moneda");
  const moneySublabel = canTotal ? undefined : "Ver desglose al pie de la tabla";
  /* Sin total posible, el tono tampoco puede salir del neto mezclado. */
  const netTone: StatCardTone = !canTotal ? "neutral" : stats.netAmount >= 0 ? "success" : "warning";
  const needsReviewTone: StatCardTone = stats.needsReviewCount > 0 ? "warning" : "neutral";

  const incomeActive = activeDirection === "credit";
  const expenseActive = activeDirection === "debit";
  const topCanonicalActive =
    stats.topCanonical != null && activeCanonicalCategory === stats.topCanonical.code;

  /* Muted state: filtro hermano vuelve tautológica la métrica. */
  const expenseMuted = incomeActive;
  const incomeMuted = expenseActive;
  const netMuted = incomeActive || expenseActive;

  return (
    <div className="space-y-2">
      {stats.dataStatus === "partial" && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-warning-500/30 bg-warning-500/10 px-3 py-2 text-xs text-warning-700"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <p>
            Estas estadísticas corresponden a los movimientos visibles. El período seleccionado
            tiene más movimientos clasificados de los que se descargaron; afina el filtro de período
            para ver agregados completos.
          </p>
        </div>
      )}

      <QavanteCard
        variant="bordered"
        aria-label="Resumen de movimientos clasificados"
        role="region"
      >
        <div className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4">
          <ClasificadosStatCard
            label="Movimientos"
            value={String(stats.count)}
            tooltip="Cantidad total de movimientos clasificados que cumplen los filtros actuales."
          />
          <ClasificadosStatCard
            label="Ingresos"
            value={money(stats.incomeAmount)}
            tone={canTotal ? "success" : "neutral"}
            tooltip={noTotalReason ?? "Suma de movimientos con dirección ingreso."}
            active={incomeActive}
            muted={incomeMuted}
            sublabel={incomeActive ? "Filtro activo · clic para quitar" : moneySublabel}
            onClick={
              onApplyDirectionFilter
                ? () => onApplyDirectionFilter(incomeActive ? null : "credit")
                : undefined
            }
            actionLabel={incomeActive ? "Quitar filtro de ingresos" : "Filtrar solo ingresos"}
          />
          <ClasificadosStatCard
            label="Egresos"
            value={money(stats.expenseAmount)}
            tone={canTotal ? "warning" : "neutral"}
            tooltip={noTotalReason ?? "Suma de movimientos con dirección egreso."}
            active={expenseActive}
            muted={expenseMuted}
            sublabel={expenseActive ? "Filtro activo · clic para quitar" : moneySublabel}
            onClick={
              onApplyDirectionFilter
                ? () => onApplyDirectionFilter(expenseActive ? null : "debit")
                : undefined
            }
            actionLabel={expenseActive ? "Quitar filtro de egresos" : "Filtrar solo egresos"}
          />
          <ClasificadosStatCard
            label="Neto"
            value={money(stats.netAmount)}
            tone={netTone}
            muted={netMuted}
            sublabel={moneySublabel}
            tooltip={noTotalReason ?? "Ingresos clasificados menos egresos clasificados."}
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
                topCanonicalActive
                  ? "Filtro activo · clic para quitar"
                  : stats.topCanonical.count === 1
                    ? "1 movimiento"
                    : `${stats.topCanonical.count} movimientos`
              }
              tooltip="Categoría canónica con más movimientos en los filtros actuales."
              active={topCanonicalActive}
              onClick={
                onApplyCanonicalCategoryFilter
                  ? () =>
                      onApplyCanonicalCategoryFilter(
                        topCanonicalActive ? null : stats.topCanonical!.code,
                      )
                  : undefined
              }
              actionLabel={
                topCanonicalActive
                  ? `Quitar filtro de ${stats.topCanonical.label}`
                  : `Filtrar por ${stats.topCanonical.label}`
              }
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
      </QavanteCard>
    </div>
  );
}

function formatLastClassified(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "s/d";
  return formatDate(d);
}

function StatsSkeleton() {
  return (
    <QavanteCard variant="bordered">
      <div
        aria-busy="true"
        aria-label="Cargando resumen de movimientos clasificados"
        className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1 py-1">
            <div className="h-3 w-20 animate-pulse rounded bg-neutral-light/60" />
            <div className="h-5 w-24 animate-pulse rounded bg-neutral-light" />
          </div>
        ))}
      </div>
    </QavanteCard>
  );
}
