"use client";

import * as React from "react";
import { usePreferences } from "@/lib/api/preferences";
import { useAccountsPayable } from "@/lib/api/pagos";
import { useMaestroDocs } from "@/components/terminos/use-maestro-docs";
import { readTerminos, readPagados, buildMaestro } from "@/components/terminos/terminos-pago";
import { CajaProyeccionView } from "./caja-proyeccion-view";
import {
  movimientosDeMaestro,
  movimientosDeObligaciones,
  movimientosPorSemana,
  proyeccionDeMovimientos,
} from "./caja-proyeccion-model";
import type { MovimientoCaja } from "./caja-cascada-model";

/* CajaProyeccionLive — container del rediseño de la proyección de caja (Caja v3, gated `cajaV3`).
   La proyección sale de los VENCIMIENTOS DERIVADOS (no del cash-flow histórico): cobranzas del
   maestro AR (ventas) + pagos de los maestros AP (compras/honorarios) + obligaciones reales de
   accounts-payable (payroll/tax/rent/debt/leasing — NO "other", que es ruido de tarjeta ya pagado,
   ni "supplier", que ya viene del maestro). El acumulado sobre `cash_today` (que el parent ya tiene)
   da el medidor; los movimientos por semana, la cascada. Container: NO se testea por Storybook
   (ADR-0018); la lógica vive en `caja-proyeccion-model` (con unit tests). */

const HORIZONTE_DIAS = 120; // ~4 meses de proyección forward
// Obligaciones reales de accounts-payable que SÍ son pagos futuros (el resto es ruido o duplica el maestro).
const OBLIG_CATS = new Set(["payroll", "tax", "rent", "debt", "leasing"]);

export interface CajaProyeccionLiveProps {
  /** Saldo de hoy (cash_today) — el parent (resumen-live) ya lo tiene del dashboard. */
  saldoHoy: number;
  /** Caja mínima (CLP) o `null`. */
  minimo: number | null;
  /** El `cash_today` viene stale (banco sin sync reciente). */
  saldoStale?: boolean;
  /** Fecha legible de la última sync del banco (para el aviso honesto). */
  ultimaSync?: string | null;
}

export function CajaProyeccionLive({
  saldoHoy,
  minimo,
  saldoStale,
  ultimaSync,
}: CajaProyeccionLiveProps) {
  const prefs = usePreferences();
  const ventasDocs = useMaestroDocs("ventas");
  const comprasDocs = useMaestroDocs("compras");
  const honorariosDocs = useMaestroDocs("honorarios");
  const ap = useAccountsPayable();

  const { proyeccion, movimientosCascada } = React.useMemo(() => {
    const now = new Date();
    const terminos = readTerminos(prefs.data?.preferences);
    const pagados = readPagados(prefs.data?.preferences);

    const cobranzas = ventasDocs.docs.length
      ? buildMaestro(ventasDocs.docs, terminos, "ventas", now, pagados)
      : [];
    const proveedores = comprasDocs.docs.length
      ? buildMaestro(comprasDocs.docs, terminos, "compras", now, pagados)
      : [];
    const honorarios = honorariosDocs.docs.length
      ? buildMaestro(honorariosDocs.docs, terminos, "honorarios", now, pagados)
      : [];
    const obligaciones = (ap.data?.items ?? []).filter((i) => OBLIG_CATS.has(i.category ?? ""));

    const movs: MovimientoCaja[] = [
      ...movimientosDeMaestro(cobranzas, 1, "cobranza", now, HORIZONTE_DIAS),
      ...movimientosDeMaestro(proveedores, -1, "proveedor", now, HORIZONTE_DIAS),
      ...movimientosDeMaestro(honorarios, -1, "otro", now, HORIZONTE_DIAS),
      ...movimientosDeObligaciones(obligaciones, now, HORIZONTE_DIAS),
    ];

    // Medidor: acumulado sobre TODOS los movimientos (exacto). Cascada: agregados por semana (legible).
    return {
      proyeccion: proyeccionDeMovimientos(saldoHoy, movs, now, minimo),
      movimientosCascada: movimientosPorSemana(movs, now),
    };
  }, [
    ventasDocs.docs,
    comprasDocs.docs,
    honorariosDocs.docs,
    ap.data,
    prefs.data,
    saldoHoy,
    minimo,
  ]);

  return (
    <CajaProyeccionView
      proyeccion={proyeccion}
      minimo={minimo}
      movimientos={movimientosCascada}
      ultimaSync={ultimaSync}
      saldoStale={saldoStale}
    />
  );
}
