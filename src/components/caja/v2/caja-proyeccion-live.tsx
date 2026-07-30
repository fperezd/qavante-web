"use client";

import * as React from "react";
import { usePreferences } from "@/lib/api/preferences";
import { useAccountsPayable } from "@/lib/api/pagos";
import { useMaestroDocs } from "@/components/terminos/use-maestro-docs";
import { readTerminos, readPagados, buildMaestro } from "@/components/terminos/terminos-pago";
import { CajaProyeccionView } from "./caja-proyeccion-view";
import {
  causasDelPiso,
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
// Gracia de past-due: incluimos vencimientos vencidos hasta hace 7 días (aún probablemente pendientes);
// los más viejos se excluyen porque casi seguro ya se pagaron y están en el cash_today (contarlos de
// nuevo duplica plata ya gastada — validación real Tooxs 2026-07-21: sin esto el piso daba −$43M irreal).
const GRACE_DIAS = 7;
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

  const { proyeccion, movimientosCascada, causas } = React.useMemo(() => {
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
      ...movimientosDeMaestro(cobranzas, 1, "cobranza", now, HORIZONTE_DIAS, GRACE_DIAS),
      ...movimientosDeMaestro(proveedores, -1, "proveedor", now, HORIZONTE_DIAS, GRACE_DIAS),
      ...movimientosDeMaestro(honorarios, -1, "otro", now, HORIZONTE_DIAS, GRACE_DIAS),
      ...movimientosDeObligaciones(obligaciones, now, HORIZONTE_DIAS, GRACE_DIAS),
    ];

    // Medidor: acumulado sobre TODOS los movimientos (exacto). Cascada: agregados por semana (legible).
    const proy = proyeccionDeMovimientos(saldoHoy, movs, now, minimo);
    return {
      proyeccion: proy,
      movimientosCascada: movimientosPorSemana(movs, now),
      // Causas del piso: los mayores egresos INDIVIDUALES hasta el día del punto más bajo (label real).
      causas: proy?.piso ? causasDelPiso(movs, now, proy.piso.dia, 3) : [],
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

  // Sin las prefs (conciliaciones) la proyección trataría docs ya pagados como movimientos → esperar.
  if (prefs.isLoading) return null;

  return (
    <CajaProyeccionView
      proyeccion={proyeccion}
      minimo={minimo}
      movimientos={movimientosCascada}
      causas={causas}
      ultimaSync={ultimaSync}
      saldoStale={saldoStale}
      ocultarSaldoHoy // el hero del Resumen ya muestra el saldo de hoy → no repetirlo en el medidor
    />
  );
}
