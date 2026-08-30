"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDashboardSummary } from "@/lib/api/dashboard";
import { useCashCycle } from "@/lib/api/treasury";
import {
  useOperationalResult,
  useOperationalResultAlDia,
  useOperationalResultBreakdown,
  useOperationalResultDocuments,
} from "@/lib/api/gestion";
import { useMaestroDocs } from "@/components/terminos/use-maestro-docs";
import type { PeriodRange } from "@/lib/period/period-range";
import { ApiError } from "@/lib/api/errors";
import { currentPeriodSantiago, shiftPeriod } from "../gestion-format";
import {
  DIA_MES_COMPLETO,
  diaDelMesSantiago,
  tabDesdeQuery,
  type TabV08,
} from "./gestion-v08-model";
import { GestionV08View, type DrillAbierto } from "./gestion-v08-view";

/* Cableado de V08 · Gestión. La vista es presentacional; acá se resuelven las fuentes y —esto es
 * lo importante— se decide QUÉ pedir según la tab activa.
 *
 * Por qué la tab vive acá y no dentro de la vista: los 360 traen el maestro RCV mes por mes (24
 * consultas al SII). Si la tab fuera estado interno de la vista, esas 24 consultas saldrían al
 * montar la pantalla aunque el usuario nunca abra Clientes. Con la tab arriba, cada `enabled`
 * cuelga de ella y la pantalla arranca pidiendo sólo lo del Resultado.
 *
 * La tab se sincroniza con `?tab=` para que las ocho rutas viejas puedan REDIRIGIR acá (ver
 * `destinoRutaVieja`) y para que el enlace sea compartible. Se navega con `replace` para no llenar
 * el historial con seis entradas por sesión.
 *
 * LAS TRES FUENTES QUE LA SPEC MARCA 🔧, medidas contra el contrato del 2026-08-30:
 *   · drill-down monto → documentos: EXISTE (`/operational-result/documents?period&account`).
 *   · corte al día del comparativo: EXISTE (`/operational-result/al-dia?period&hasta_dia`).
 *   · export xls: NO existe. Se exporta CSV desde el front (exacto sobre lo mostrado) y se dice.
 */

/** Meses del pivote (spec §V08: "pivote May/Jun/Jul"). */
const MESES_PIVOTE = 3;
/** Meses de la serie de Tendencia (el HTML muestra feb–jul; se traen 12 para el año completo). */
const MESES_TENDENCIA = 12;
/** Ventana del maestro para los 360: 24 meses cerrados + el mes en curso (estacionalidad + año
 *  contra año). Es la MISMA ventana que ya pedían `/gestion/clientes` y `/gestion/proveedores`,
 *  así que no hay carga nueva sobre el SII. */
const MESES_360 = 24;

export function GestionV08Live({ issueSucesor }: { issueSucesor?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = tabDesdeQuery(params.get("tab"));

  const [hoy] = React.useState(() => new Date());
  const [drill, setDrill] = React.useState<DrillAbierto | null>(null);

  const cambiarTab = React.useCallback(
    (t: TabV08) => {
      setDrill(null); // el drill-down pertenece al pivote; cambiar de tab lo cierra
      router.replace(`${pathname}?tab=${t}`, { scroll: false });
    },
    [pathname, router],
  );

  const periodo = currentPeriodSantiago(hoy);
  const desdePivote = shiftPeriod(periodo, -(MESES_PIVOTE - 1));
  const desdeTendencia = shiftPeriod(periodo, -(MESES_TENDENCIA - 1));
  const mesAnterior = shiftPeriod(periodo, -1);
  const hastaDia = diaDelMesSantiago(hoy);

  const rango360: PeriodRange = React.useMemo(
    () => ({ desde: shiftPeriod(periodo, -MESES_360), hasta: periodo }),
    [periodo],
  );

  /* El Resultado es la tab por defecto, así que su breakdown y el summary se piden SIEMPRE: son
     también los que alimentan el chequeo de la Ley 1 y el punto de equilibrio de Márgenes. */
  const summary = useDashboardSummary();
  const breakdown = useOperationalResultBreakdown(desdePivote, periodo);

  const breakdownLargo = useOperationalResultBreakdown(desdeTendencia, periodo, {
    enabled: tab === "tendencia",
  });
  const mes = useOperationalResult(tab === "margenes" ? periodo : "");
  const ciclo = useCashCycle();

  const alDia = useOperationalResultAlDia(periodo, hastaDia, tab === "comparativo");
  const alDiaPrevio = useOperationalResultAlDia(
    mesAnterior,
    DIA_MES_COMPLETO,
    tab === "comparativo",
  );

  const documentos = useOperationalResultDocuments(
    drill?.period ?? "",
    drill?.account ?? "",
    drill != null,
  );

  const ventas = useMaestroDocs("ventas", tab === "clientes", rango360);
  const compras = useMaestroDocs("compras", tab === "proveedores", rango360);
  const maestro = tab === "clientes" ? ventas : compras;

  const recargar = React.useCallback(() => {
    void summary.refetch();
    void breakdown.refetch();
    if (tab === "tendencia") void breakdownLargo.refetch();
    if (tab === "margenes") {
      void mes.refetch();
      void ciclo.refetch();
    }
    if (tab === "comparativo") {
      void alDia.refetch();
      void alDiaPrevio.refetch();
    }
  }, [summary, breakdown, breakdownLargo, mes, ciclo, alDia, alDiaPrevio, tab]);

  if (tab === "resultado" && breakdown.isLoading) return <CargandoGestion />;

  return (
    <GestionV08View
      tab={tab}
      onTabChange={cambiarTab}
      summary={summary.data ?? null}
      breakdown={breakdown.data ?? null}
      breakdownLargo={breakdownLargo.data ?? null}
      mes={mes.data ?? null}
      alDia={alDia.data ?? null}
      alDiaPrevioCompleto={alDiaPrevio.data ?? null}
      ciclo={ciclo.data ?? null}
      docs360={maestro.isError && maestro.docs.length === 0 ? null : maestro.docs}
      docs360Cargando={maestro.isInitialLoading}
      drill={drill}
      drillDocs={documentos.data ?? null}
      drillCargando={drill != null && documentos.isLoading}
      onDrill={setDrill}
      motivos={{
        resultado: breakdown.isError ? motivo(breakdown.error, "el motor de gestión") : undefined,
        comparativo: alDia.isError ? motivo(alDia.error, "el corte al día del mes") : undefined,
        ciclo: ciclo.isError ? motivo(ciclo.error, "el cálculo del ciclo de caja") : undefined,
        contrapartes: maestro.isError ? motivo(null, "el registro de compras y ventas") : undefined,
      }}
      onReintentar={recargar}
      hoy={hoy}
      issueSucesor={issueSucesor}
    />
  );
}

/** Por qué no llegó, en lenguaje de dueño (§5.4: un error siempre dice su causa). */
export function motivo(err: unknown, fuente: string): string {
  if (err instanceof ApiError && err.isNetworkError()) {
    return `No pudimos conectar con ${fuente} (error de red). Vuelve a intentar en un momento.`;
  }
  return `${capitalizarPrimera(fuente)} no respondió. Vuelve a intentar en un momento; si sigue igual, revisa tus conexiones.`;
}

function capitalizarPrimera(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* §5.4 — un estado de carga habla: qué se está trayendo y cuánto tarda. */
function CargandoGestion() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <p className="text-sm text-rediseno-tinta-3">
        Estamos armando tu Estado de Resultados de los últimos tres meses, cuenta por cuenta (~6 s).
      </p>
      <div className="grid gap-3 sm:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-[14px] bg-rediseno-neutro-bg" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-[14px] bg-rediseno-neutro-bg" aria-hidden="true" />
    </div>
  );
}
