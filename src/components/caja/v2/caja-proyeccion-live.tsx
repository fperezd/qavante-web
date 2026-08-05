"use client";

import * as React from "react";
import { usePreferences } from "@/lib/api/preferences";
import { useAccountsPayable } from "@/lib/api/pagos";
import { useCashProjection } from "@/lib/api/treasury";
import { useMaestroDocs } from "@/components/terminos/use-maestro-docs";
import { readTerminos, readPagados, buildMaestro } from "@/components/terminos/terminos-pago";
import { parseAmount } from "@/components/gestion/gestion-format";
import { CajaProyeccionView } from "./caja-proyeccion-view";
import {
  movimientosDeMaestro,
  movimientosDeObligaciones,
  movimientosPorSemana,
} from "./caja-proyeccion-model";
import { cashProjectionToDiasCaja, causasFromCashProjection } from "./caja-cash-projection-map";
import type { MovimientoCaja } from "./caja-cascada-model";

/* CajaProyeccionLive — container del medidor de caja (Caja v3, gated `cajaV3`).

   MODELO ÚNICO DE CAJA (#770 / ADR-0085): el MEDIDOR + la CURVA + el PUNTO DE QUIEBRE + los días de
   caja salen del backend (`GET /api/treasury/cash-projection`) — una sola fuente de verdad. Antes el
   FE re-proyectaba por su cuenta (`caja-proyeccion-model`) y daba una respuesta distinta al backend y
   al Pulso ("3 respuestas a ¿cuánta caja tengo?"). Con el fix del día-1-dump (CC-API #802) la serie del
   backend ya es honesta, así que se RETIRA la reproyección FE del medidor.

   La CASCADA de próximos movimientos SÍ se sigue derivando del maestro (cobranzas AR + pagos AP +
   obligaciones): el backend aún no expone el detalle por-movimiento. Es un dato legítimo; el número de
   días/piso ya NO sale de acá. Container: no se testea por Storybook (ADR-0018); la lógica pura vive en
   `caja-cash-projection-map` (medidor) y `caja-proyeccion-model` (cascada), ambas con unit tests. */

const HORIZONTE_DIAS = 90; // horizonte de la proyección del backend (y de la cascada derivada)
// Gracia de past-due de la CASCADA: incluimos vencimientos vencidos hasta hace 7 días (aún probablemente
// pendientes); los más viejos casi seguro ya se pagaron y están en el saldo → contarlos duplica plata.
const GRACE_DIAS = 7;
// Obligaciones reales de accounts-payable que SÍ son pagos futuros (el resto es ruido o duplica el maestro).
const OBLIG_CATS = new Set(["payroll", "tax", "rent", "debt", "leasing"]);

export interface CajaProyeccionLiveProps {
  /** Saldo de hoy (cash_today) — el parent (resumen-live) ya lo tiene del dashboard. Solo respaldo. */
  saldoHoy: number;
  /** Caja mínima (CLP) o `null`. Solo respaldo (la del backend manda para el medidor). */
  minimo: number | null;
  /** El `cash_today` viene stale (banco sin sync reciente). */
  saldoStale?: boolean;
  /** Fecha legible de la última sync del banco (para el aviso honesto). */
  ultimaSync?: string | null;
}

export function CajaProyeccionLive({ minimo, saldoStale, ultimaSync }: CajaProyeccionLiveProps) {
  const prefs = usePreferences();
  const ventasDocs = useMaestroDocs("ventas");
  const comprasDocs = useMaestroDocs("compras");
  const honorariosDocs = useMaestroDocs("honorarios");
  const ap = useAccountsPayable();
  const cashProj = useCashProjection(HORIZONTE_DIAS);

  // Medidor + curva + punto de quiebre + causas: FUENTE ÚNICA = backend.
  const proyeccion = React.useMemo(() => cashProjectionToDiasCaja(cashProj.data), [cashProj.data]);
  const causas = React.useMemo(() => causasFromCashProjection(cashProj.data), [cashProj.data]);
  // La caja mínima del readout sale del backend (consistente con la proyección); 0 = sin mínima → no la
  // mostramos ($0 se lee raro). Si el backend no cargó, cae a la del parent.
  const minimoBackend = cashProj.data ? parseAmount(cashProj.data.minimo) : null;
  const minimoView = minimoBackend != null ? (minimoBackend > 0 ? minimoBackend : null) : minimo;

  // Por cobrar vencido/sin-fecha: el backend lo EXCLUYE del runway (su cobro no es cierto), pero es la
  // pieza que explica que "sin recuperación" no sea el final de la historia. Se muestra como caveat.
  const pcv = cashProj.data?.por_cobrar_vencido;
  const porCobrarVencido = pcv ? { total: parseAmount(pcv.total), n: pcv.n } : null;

  // Cascada de próximos movimientos: derivada del maestro (el backend no expone el detalle por-movimiento).
  const movimientosCascada = React.useMemo(() => {
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
    return movimientosPorSemana(movs, now);
  }, [ventasDocs.docs, comprasDocs.docs, honorariosDocs.docs, ap.data, prefs.data]);

  // Sin la proyección del backend (cargando) o sin prefs (conciliaciones) → esperar, no proyectar mal.
  if (prefs.isLoading || cashProj.isLoading) return null;

  return (
    <CajaProyeccionView
      proyeccion={proyeccion}
      minimo={minimoView}
      movimientos={movimientosCascada}
      causas={causas}
      porCobrarVencido={porCobrarVencido}
      conciliarHref="/caja/conciliacion"
      ultimaSync={ultimaSync}
      saldoStale={saldoStale}
      ocultarSaldoHoy // el hero del Resumen ya muestra el saldo de hoy → no repetirlo en el medidor
    />
  );
}
