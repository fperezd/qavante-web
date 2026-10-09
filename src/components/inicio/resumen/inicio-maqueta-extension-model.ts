import type { DashboardSummaryV2 } from "@/lib/api/dashboard";
import type { CashProjectionViewModel } from "@/components/cash-projection-runs/cash-projection-run-model";
import { formatClp } from "@/lib/formatters/clp";
import { parseAmountOrNull } from "@/lib/formatters/amount";
import { pulsoStatusLabel } from "@/components/inicio/dashboard-format";
import { anilloDelPulso } from "@/components/inicio/pulso-ring-model";

export const API_SUMMARY = "GET /api/dashboard/summary";
export const API_PROJECTION = "GET /api/cash-projection-runs (horizon_days=14, escenario vigente)";

export interface CampoInicio {
  conectado: boolean;
  api: string;
  valor: string;
}

export interface AccionDiaInicio {
  numero: string;
  titulo: string;
  descripcion: string;
  href: string;
  tono: string;
  conectado: boolean;
  api: string;
}

const TONOS_ACCION = [
  "border-red-200 bg-red-50/70",
  "border-amber-200 bg-amber-50/70",
  "border-blue-200 bg-blue-50/70",
] as const;

const ACCIONES_PLACEHOLDER: Omit<AccionDiaInicio, "conectado">[] = [
  {
    numero: "01",
    titulo: "Revisar pagos próximos",
    descripcion: "Hay compromisos que podrían generar una falta de caja en los próximos 14 días.",
    href: "/pagar",
    tono: TONOS_ACCION[0]!,
    api: `${API_SUMMARY} · campo priority_actions (acciones priorizadas por el servidor)`,
  },
  {
    numero: "02",
    titulo: "Gestionar cobros vencidos",
    descripcion: "Revisa qué clientes pueden aportar liquidez y registra el próximo seguimiento.",
    href: "/cobrar",
    tono: TONOS_ACCION[1]!,
    api: `${API_SUMMARY} · overdue_collections y priority_actions de cobranza`,
  },
  {
    numero: "03",
    titulo: "Actualizar conexión bancaria",
    descripcion: "Algunos saldos no están actualizados con información de hoy.",
    href: "/banco",
    tono: TONOS_ACCION[2]!,
    api: "GET /api/treasury/bank-accounts · balance_as_of del día y estado de conexión",
  },
];

export function pulsoInicio(data: DashboardSummaryV2 | null) {
  const pulso = data?.pulso;
  if (!pulso || pulso.status == null) {
    return {
      conectado: false as const,
      api: `${API_SUMMARY} · bloque pulso (score, status, drivers)`,
      badge: "Sin dato",
      badgeClass: "bg-neutral-light text-neutral-mid",
      titular: "Tu pulso aparecerá cuando el resumen traiga el bloque pulso.",
      cuerpo:
        "Hoy mostramos la estructura de la maqueta; el score y los drivers vienen del mismo endpoint que alimenta Inicio Ejecutivo.",
    };
  }
  const anillo = anilloDelPulso(pulso.score, pulso.status);
  const titular =
    data?.executive_phrase?.trim() ||
    pulso.top_driver_negative ||
    "Revisa el detalle del pulso para entender qué mover primero.";
  const cuerpo =
    [pulso.top_driver_negative, pulso.top_driver_positive].filter(Boolean).join(" · ") ||
    "Drivers del pulso publicados en el resumen del dashboard.";
  return {
    conectado: true as const,
    api: API_SUMMARY,
    badge: `${anillo.numero === "n/d" ? pulso.score : anillo.numero} · ${pulsoStatusLabel(pulso.status)}`,
    badgeClass:
      pulso.status === "critical"
        ? "bg-red-50 text-red-700"
        : pulso.status === "weak"
          ? "bg-amber-50 text-amber-800"
          : "bg-emerald-50 text-emerald-700",
    titular,
    cuerpo,
  };
}

export function resultadoMesInicio(data: DashboardSummaryV2 | null): CampoInicio {
  const result = parseAmountOrNull(data?.operational_result?.result ?? null);
  if (result == null) {
    return {
      conectado: false,
      api: `${API_SUMMARY} · bloque operational_result (último mes cerrado)`,
      valor: "Sin dato",
    };
  }
  return {
    conectado: true,
    api: API_SUMMARY,
    valor: formatClp(result),
  };
}

export function accionesDiaInicio(data: DashboardSummaryV2 | null): AccionDiaInicio[] {
  const fromApi = (data?.priority_actions ?? []).slice(0, 3);
  if (fromApi.length > 0) {
    return fromApi.map((action, index) => ({
      numero: String(action.priority).padStart(2, "0"),
      titulo: action.reason,
      descripcion:
        [action.deadline, action.impact_label].filter(Boolean).join(" · ") || action.cta_label,
      href: action.cta_href,
      tono: TONOS_ACCION[index % TONOS_ACCION.length]!,
      conectado: true,
      api: API_SUMMARY,
    }));
  }
  return ACCIONES_PLACEHOLDER.map((item) => ({ ...item, conectado: false }));
}

export function componentesProyeccionInicio(
  data: DashboardSummaryV2 | null,
  projection: CashProjectionViewModel | null | undefined,
): { tiles: CampoInicio[]; notaConectada: boolean } {
  const saldo = parseAmountOrNull(data?.cash_today?.total ?? null);
  const faltante = parseAmountOrNull(data?.cash_gap?.cash_gap_amount_14d ?? null);

  let cobros: CampoInicio = {
    conectado: false,
    api: `${API_PROJECTION} · suma de componentes inflow del puente del escenario`,
    valor: "Sin dato",
  };
  let pagos: CampoInicio = {
    conectado: false,
    api: `${API_PROJECTION} · suma de componentes outflow del puente del escenario`,
    valor: "Sin dato",
  };

  if (projection?.state === "current" && projection.scenario.bridge.components.length > 0) {
    let inflow = 0;
    let outflow = 0;
    for (const c of projection.scenario.bridge.components) {
      const amount = parseAmountOrNull(c.functional_amount);
      if (amount == null) continue;
      if (c.direction === "inflow") inflow += amount;
      else outflow += Math.abs(amount);
    }
    cobros = { conectado: true, api: API_PROJECTION, valor: `+${formatClp(inflow)}` };
    pagos = { conectado: true, api: API_PROJECTION, valor: `−${formatClp(outflow)}` };
  }

  const tiles: CampoInicio[] = [
    saldo != null
      ? { conectado: true, api: API_SUMMARY, valor: formatClp(saldo) }
      : {
          conectado: false,
          api: `${API_SUMMARY} · cash_today.total`,
          valor: "Sin dato",
        },
    cobros,
    pagos,
    faltante != null && data?.cash_gap?.has_gap
      ? { conectado: true, api: API_SUMMARY, valor: `−${formatClp(faltante)}` }
      : {
          conectado: false,
          api: `${API_SUMMARY} · cash_gap.cash_gap_amount_14d`,
          valor: "Sin dato",
        },
  ];

  return {
    tiles,
    notaConectada: tiles.every((t) => t.conectado),
  };
}
