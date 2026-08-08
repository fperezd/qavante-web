"use client";

import * as React from "react";
import { usePreferences } from "@/lib/api/preferences";
import { useAccountsPayable } from "@/lib/api/pagos";
import { useMaestroDocs } from "@/components/terminos/use-maestro-docs";
import { readTerminos, readPagados, buildMaestro } from "@/components/terminos/terminos-pago";
import { AgendaWidget } from "./agenda-widget";
import { componerAgenda, agruparAgenda, totalesAgenda } from "./agenda-model";

/* Contenedor del widget Agenda (Inicio v2, gated `inicioAgenda`). Compone los vencimientos de los
   próximos 14 días del mismo modo que la cascada de Caja: maestro AR (cobros) + maestro AP
   (proveedores/honorarios) + obligaciones de accounts-payable (F29/Previred/sueldos/arriendo/deuda/
   leasing). Container: NO se testea por Storybook (ADR-0018); la lógica vive en `agenda-model`
   (unit). Degrada solo: sin prefs (necesarias para derivar vencimientos) → no renderiza. */

export function AgendaLive() {
  const prefs = usePreferences();
  const ventasDocs = useMaestroDocs("ventas");
  const comprasDocs = useMaestroDocs("compras");
  const honorariosDocs = useMaestroDocs("honorarios");
  const ap = useAccountsPayable();

  const { grupos, cobros, pagos } = React.useMemo(() => {
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

    const movs = componerAgenda(cobranzas, proveedores, honorarios, ap.data?.items ?? [], now);
    const t = totalesAgenda(movs);
    return { grupos: agruparAgenda(movs, now), cobros: t.cobros, pagos: t.pagos };
  }, [ventasDocs.docs, comprasDocs.docs, honorariosDocs.docs, ap.data, prefs.data]);

  // Sin prefs (necesarias para los términos de pago) → esperar, no mostrar vencimientos mal fechados.
  if (prefs.isLoading) return null;

  return <AgendaWidget grupos={grupos} cobros={cobros} pagos={pagos} />;
}
