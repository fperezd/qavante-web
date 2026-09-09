"use client";

import * as React from "react";
import { useSiiF29Estado, useSiiF29Impuesto, type F29EstadoMes } from "@/lib/api/sii";
import { useTgrHealth, useTgrMovimientosDeudas, type TgrDeudas } from "@/lib/api/tgr";
import { useBukPayroll } from "@/lib/api/buk";
import { ApiError } from "@/lib/api/errors";
import {
  estimacionF29V06,
  filasCalendarioV06,
  TGR_EN_PREPARACION_MOTIVO,
  ventanaPeriodosV06,
  type FuenteTgrV06,
} from "./impuestos-v06-model";
import { ImpuestosV06View } from "./impuestos-v06-view";

/* Cableado de V06 · Impuestos. La vista es presentacional; acá se resuelven las fuentes
 * (ver la cabecera de `impuestos-v06-model.ts` para el porqué de cada una):
 *
 *   · `GET /api/sii/f29/estado?anio=` (`useSiiF29Estado`) — se piden los 1 ó 2 años que cubren la
 *     ventana de 6 meses (`ventanaPeriodosV06`); casi siempre son el año en curso y el anterior
 *     sólo entre enero y junio, cuando la ventana cruza el borde de año.
 *   · `GET /api/sii/f29/impuesto?anio=&mes=` (`useSiiF29Impuesto`) — estimación R2 del mes actual;
 *     el modelo exige `estimable=true`, conserva `missing_inputs` y no recalcula sus montos.
 *   · `GET /api/buk/payroll?period=` (`useBukPayroll`) — el período actual, MISMA fuente que
 *     `previred-view.tsx` y V16 (Ley 1).
 *   · `GET /api/tgr/health` + `/movimientos-deudas` (`useTgrHealth`/`useTgrMovimientosDeudas`) —
 *     MISMA fuente que `deudas-tgr-view.tsx`; `authenticated` decide si se pide la segunda.
 *
 * El F-29 es la fuente CRÍTICA (sin ella no hay calendario que armar): si su query principal
 * falla, la pantalla completa entra en estado de error. Previred/TGR degradan dentro del modelo
 * puro. TGR transporta explícitamente error, payload ausente y lista confirmada: sólo esta última
 * puede sostener "Sin deuda". */

const VENTANA_MESES = 6;

export function ImpuestosV06Live({ issueSucesor }: { issueSucesor?: string }) {
  const [hoy] = React.useState(() => new Date());
  const periodos = React.useMemo(() => ventanaPeriodosV06(hoy, VENTANA_MESES), [hoy]);
  const anios = React.useMemo(
    () => Array.from(new Set(periodos.map((p) => Number(p.slice(0, 4))))).sort(),
    [periodos],
  );
  const periodoActual = periodos[periodos.length - 1]!;
  const anioActual = Number(periodoActual.slice(0, 4));
  const mesActual = Number(periodoActual.slice(5, 7));

  const f29Principal = useSiiF29Estado(anios[0]!);
  const f29Secundario = useSiiF29Estado(anios[1] ?? anios[0]!, anios.length > 1);
  const f29Impuesto = useSiiF29Impuesto(anioActual, mesActual);

  const payroll = useBukPayroll({ period: periodoActual });

  const tgrHealth = useTgrHealth();
  const tgrAutenticado = tgrHealth.data?.authenticated === true;
  const tgrDeudas = useTgrMovimientosDeudas(tgrAutenticado);

  const cargando =
    f29Principal.isLoading ||
    (anios.length > 1 && f29Secundario.isLoading) ||
    f29Impuesto.isLoading ||
    tgrHealth.isLoading ||
    (tgrAutenticado && tgrDeudas.isLoading) ||
    payroll.isLoading;

  if (cargando) {
    return <ImpuestosV06View hoy={hoy} filas={undefined} issueSucesor={issueSucesor} />;
  }

  if (f29Principal.isError) {
    return (
      <ImpuestosV06View
        hoy={hoy}
        filas={undefined}
        error={motivoSinF29(f29Principal.error)}
        onReintentar={() => void f29Principal.refetch()}
        issueSucesor={issueSucesor}
      />
    );
  }

  const mesesPorPeriodo = new Map<string, F29EstadoMes>();
  for (const respuesta of [f29Principal.data, anios.length > 1 ? f29Secundario.data : undefined]) {
    const meses = (respuesta?.meses ?? []) as unknown as F29EstadoMes[];
    for (const m of meses) {
      if (typeof m?.periodo === "string") mesesPorPeriodo.set(m.periodo, m);
    }
  }
  const mesesF29 = periodos
    .map((p) => mesesPorPeriodo.get(p))
    .filter((m): m is F29EstadoMes => m != null);

  const totales = payroll.data?.totales;
  const estimacion = estimacionF29V06(
    f29Impuesto.data,
    f29Impuesto.isError ? motivoSinEstimacion(f29Impuesto.error) : null,
  );
  const tgr = resolverFuenteTgrV06({
    authenticated: tgrAutenticado,
    healthError: tgrHealth.isError,
    healthStatus: tgrHealth.data?.status,
    debtError: tgrDeudas.isError,
    deudas: tgrDeudas.data,
  });

  const filas = filasCalendarioV06({
    mesesF29,
    estimacionF29: estimacion,
    previred: {
      period: periodoActual,
      totalCotizaciones: totales?.total_cotizaciones ?? null,
      empleados: totales?.empleados_contados ?? null,
    },
    tgr,
    hoy,
  });

  return (
    <ImpuestosV06View
      hoy={hoy}
      filas={filas}
      estimacionF29={estimacion}
      issueSucesor={issueSucesor}
    />
  );
}

export function resolverFuenteTgrV06(entrada: {
  authenticated: boolean;
  healthError: boolean;
  healthStatus: string | undefined;
  debtError: boolean;
  deudas: TgrDeudas | undefined;
}): FuenteTgrV06 {
  if (entrada.healthError) {
    return {
      estado: "error",
      motivo:
        "No pudimos consultar el estado de conexión con TGR. No afirmamos que la deuda sea cero.",
    };
  }
  if (!entrada.healthStatus) {
    return {
      estado: "sin_dato",
      motivo: "TGR no entregó el estado de conexión. No sabemos si existen deudas vigentes.",
    };
  }
  if (entrada.healthStatus !== "ok") {
    return {
      estado: "error",
      motivo: "TGR respondió con error al consultar la conexión. No afirmamos una deuda cero.",
    };
  }
  if (!entrada.authenticated) {
    return { estado: "sin_dato", motivo: TGR_EN_PREPARACION_MOTIVO };
  }
  if (entrada.debtError) {
    return {
      estado: "error",
      motivo: "TGR no respondió al consultar las deudas. No mostramos un cero como reemplazo.",
    };
  }
  if (!entrada.deudas) {
    return {
      estado: "sin_dato",
      motivo: "TGR no entregó el detalle de deudas. No sabemos si el saldo es cero.",
    };
  }
  if (entrada.deudas.status !== "ok") {
    return {
      estado: "error",
      motivo: "TGR respondió con error. No sabemos si existen deudas vigentes.",
    };
  }
  if (!Array.isArray(entrada.deudas.movimientos)) {
    return {
      estado: "sin_dato",
      motivo: "TGR respondió sin la lista de movimientos. No sabemos si el saldo es cero.",
    };
  }
  return { estado: "ok", movimientos: entrada.deudas.movimientos };
}

/** Por qué no llegó el F-29, en lenguaje de dueño (mismo patrón que `presupuesto-v09-live.tsx`). */
function motivoSinF29(err: unknown): string {
  if (err instanceof ApiError && err.isNetworkError()) {
    return "No pudimos conectar con el SII (error de red). Vuelve a intentar en un momento.";
  }
  return "El SII no respondió. Vuelve a intentar en un momento; si sigue igual, revisa tus conexiones.";
}

/** La estimación es degradable: el calendario sigue disponible si este endpoint falla. */
export function motivoSinEstimacion(err: unknown): string {
  if (err instanceof ApiError && err.isNetworkError()) {
    return "No pudimos consultar la estimación por un error de red. No mostramos un monto desactualizado como reemplazo.";
  }
  return "No pudimos consultar la estimación segura del mes. El calendario conserva los estados oficiales disponibles.";
}
