/* V01 · Hoy — el modelo PURO de la vista (rediseño Fase 2, issue #62).
 *
 * Contesta UNA pregunta: "¿cómo está mi empresa y qué necesita mi OK?".
 *
 * Sin React a propósito: el veredicto de la portada es la afirmación más cara de la app —la que
 * el dueño lee antes que ninguna otra— y tiene que poder fijarse en un test sin montar un DOM.
 * Es el mismo motivo por el que `pulso-ring-model.ts` vive separado de su componente.
 *
 * Las reglas del titular son las de la ESPECIFICACION (§V01, aceptación), literales:
 *   · caja < 0 a 14 días  → atención
 *   · sueldos en riesgo   → crisis
 * No hay motor 1.2 acá y este archivo no lo simula.
 *
 * Y hay un cuarto estado que la spec no enumera y que este módulo SÍ tiene: `sin_dato`. Existe
 * porque las dos reglas se calculan sobre bloques NULLABLE del summary, y "no me llegó la caja"
 * no es "la caja está bien". `qavante-api#162` costó siete superficies diciendo "Estable" sobre
 * un tenant del que no se sabía nada; decir "sana" sobre una caja que no vino es el mismo
 * defecto con otro sustantivo. */

import type { DashboardSummaryV2, DashboardAction } from "@/lib/api/dashboard";
import { parseAmountOrNull } from "@/lib/formatters/amount";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLong, formatDateShort, formatRelative } from "@/lib/formatters/date";
import { cajaHoy, type CajaHoy } from "@/lib/finanzas/caja-hoy";
import { estadoVencimientoCritico } from "../critical-payment-status";

/** Estado del titular-veredicto. `sin_dato` NO es un color: es la ausencia de uno. */
export type EstadoHoy = "sana" | "atencion" | "crisis" | "sin_dato";

export interface VeredictoHoy {
  estado: EstadoHoy;
  /** El titular (Fraunces, una línea). */
  titular: string;
  /** Cuántas cosas esperan el OK del dueño. */
  pendientes: number;
  /** "hay N cosas que necesitan tu OK" / "No hay nada que necesite tu OK". */
  pendientesLabel: string;
  /** Subtítulo: hasta DOS líneas de contexto (spec §V01 punto 3). */
  contexto: string[];
  /** Ley 10 · día perfecto: empresa sana y nada que aprobar → el titular lo dice y termina. */
  diaPerfecto: boolean;
  /** Ley 10 · crisis: se muestra SÓLO la decisión crítica; el resto de las secciones se oculta. */
  soloDecisionCritica: boolean;
}

/* ── Sección 1 · crumb (fecha + empresa + frescura del banco) ────────────────── */

export interface CrumbHoy {
  fecha: string;
  empresa: string;
  /** Frescura del banco, en lenguaje humano. NUNCA vacío. */
  banco: string;
  /** `true` cuando el saldo no vino o vino viejo/estimado: la frescura se pinta con tono de aviso. */
  bancoConReparo: boolean;
}

/** El crumb de la portada. `hoy` explícito para poder testearlo. */
export function crumbHoy(
  tenantName: string | null | undefined,
  caja: CajaHoy,
  hoy: Date = new Date(),
): CrumbHoy {
  const empresa = tenantName?.trim() || "Tu empresa";
  if (caja.monto == null) {
    return {
      fecha: formatDateLong(hoy),
      empresa,
      banco: "Banco sin dato de saldo",
      bancoConReparo: true,
    };
  }
  const cuando = caja.actualizado ? formatRelative(caja.actualizado, hoy) : null;
  const viejo = caja.estado === "stale" || caja.estado === "estimated";
  return {
    fecha: formatDateLong(hoy),
    empresa,
    banco: cuando ? `Banco actualizado ${cuando}` : "Banco sin fecha de actualización",
    /* Sin fecha de actualización también es un reparo: un saldo sin sello no se puede creer más
       que uno viejo, y pintarlo igual que uno fresco es la misma mentira, más barata. */
    bancoConReparo: viejo || cuando == null,
  };
}

/* ── Reglas ──────────────────────────────────────────────────────────────────── */

/** ¿La caja queda bajo cero dentro de 14 días? `null` = NO SE SABE.
 *
 *  Orden deliberado, heredado de `mapEstadoBrecha`: un `has_gap: true` del backend MANDA. Él ve
 *  el valle intra-período y el colchón de caja mínima; nosotros sólo vemos el saldo al día 14.
 *  El front nunca puede degradar una brecha declarada a "holgado". */
export function cajaBajoCero14d(s: DashboardSummaryV2 | null | undefined): boolean | null {
  if (!s) return null;
  if (s.cash_gap?.has_gap) return true;
  const min14 = s.cash_forecast ? parseAmountOrNull(s.cash_forecast.min_14d) : null;
  if (min14 != null) return min14 < 0;
  if (s.cash_gap) return false; // el backend dice explícitamente que NO hay brecha
  return null;
}

/** Días civiles entre `hoy` y una fecha ISO (`YYYY-MM-DD`). `null` si no se reconoce.
 *  UTC a ambos lados: un cambio de horario en el medio no corre la cuenta en un día. */
function diasHasta(iso: string | null | undefined, hoy: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return null;
  const objetivo = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const base = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((objetivo - base) / 86_400_000);
}

/** ¿Hay sueldos en riesgo? SÓLO con evidencia dura de los dos lados (Ley 3):
 *
 *   1. `next_payroll` del backend identifica estructuralmente una nómina y vence dentro de 14
 *      días (o ya venció), y
 *   2. la caja queda bajo cero en esa misma ventana.
 *
 *  Sin las dos, no hay crisis. Un `true` acá apaga la mitad de la pantalla (Ley 10), así que el
 *  costo de inventarlo es alto y el de no adivinarlo es cero: la brecha de caja igual se cuenta
 *  como "atención". */
export function sueldosEnRiesgo(s: DashboardSummaryV2 | null | undefined, hoy: Date): boolean {
  if (cajaBajoCero14d(s) !== true) return false;
  const nomina = s?.critical_payments?.next_payroll;
  /* `next_payroll` viene restringido por el backend; si la fuente alcanzó a entregar
     `category`, ésta además debe confirmar payroll. Nunca se consulta el label: un rollout que
     aún no llena `category` conserva la evidencia estructural del selector `next_payroll`. */
  if (!nomina || (nomina.category != null && nomina.category !== "payroll")) return false;
  const dias = diasHasta(nomina.due_date, hoy);
  return dias != null && dias <= 14;
}

/* ── Contexto (subtítulo de 2 líneas) ────────────────────────────────────────── */

/** Las dos líneas de contexto. Cada una sale de un dato que EXISTE; lo que no vino no se
 *  rellena con una frase tranquilizadora — simplemente no se dice. */
export function contextoHoy(s: DashboardSummaryV2 | null | undefined, caja: CajaHoy): string[] {
  const lineas: string[] = [];

  if (caja.monto != null) {
    lineas.push(`Hoy tienes ${formatClp(caja.monto)} en caja.`);
  } else {
    lineas.push("Todavía no sabemos cuánta caja tienes: falta el saldo del banco.");
  }

  const min14 = s?.cash_forecast ? parseAmountOrNull(s.cash_forecast.min_14d) : null;
  const proximo = s?.critical_payments?.next_critical;
  if (min14 != null && min14 < 0) {
    lineas.push(`En los próximos 14 días tu caja llega a ${formatClp(min14)}.`);
  } else if (proximo) {
    const estado = estadoVencimientoCritico(proximo);
    lineas.push(
      estado === "vencido"
        ? `El pago más vencido es ${proximo.label}, del ${formatDateShort(proximo.due_date)}.`
        : estado === "proximo"
          ? `Lo próximo que vence es ${proximo.label}, el ${formatDateShort(proximo.due_date)}.`
          : `No sabemos si ${proximo.label} está vencido: falta ese estado del pago.`,
    );
  } else if (min14 != null) {
    lineas.push(`Lo más bajo que llega tu caja en 14 días es ${formatClp(min14)}.`);
  }

  return lineas.slice(0, 2);
}

/* ── Titular ─────────────────────────────────────────────────────────────────── */

/** "hay N cosas que necesitan tu OK". El singular importa: "1 cosas" delata que nadie leyó la
 *  pantalla. */
export function pendientesLabel(n: number): string {
  if (n <= 0) return "No hay nada que necesite tu OK";
  return n === 1 ? "hay 1 cosa que necesita tu OK" : `hay ${n} cosas que necesitan tu OK`;
}

const TITULAR: Record<EstadoHoy, string> = {
  crisis: "Tus sueldos están en riesgo",
  atencion: "Tu caja necesita atención",
  sana: "Tu empresa está sana",
  /* NO "sana", NO "atención": es el bucket explícito del "no sé". Neutro y no rojo — inventar
     una mala noticia es el error simétrico de inventar una buena. */
  sin_dato: "Todavía no podemos darte un veredicto",
};

/** El veredicto completo de la portada. `hoy` es explícito para poder testearlo. */
export function veredictoHoy(
  s: DashboardSummaryV2 | null | undefined,
  hoy: Date = new Date(),
  pendientesAdicionales = 0,
): VeredictoHoy {
  const caja = cajaHoy(s);
  const bajoCero = cajaBajoCero14d(s);
  const estado: EstadoHoy = sueldosEnRiesgo(s, hoy)
    ? "crisis"
    : bajoCero === true
      ? "atencion"
      : bajoCero === false
        ? "sana"
        : "sin_dato";

  /* Los casos persistidos del Decision OS son decisiones, no `priority_actions` del dashboard.
     La vista los suma de forma explícita para no decir "nada necesita tu OK" mientras muestra
     una evaluación elegible. El caller sólo pasa casos vigentes y con soporte `eligible`. */
  const pendientes = (s?.priority_actions?.length ?? 0) + Math.max(0, pendientesAdicionales);
  const diaPerfecto = estado === "sana" && pendientes === 0;

  return {
    estado,
    /* Ley 10 · día perfecto: el titular ES la buena noticia y la pantalla termina ahí. No se
       queda "Tu empresa está sana" con un "No hay nada que necesite tu OK" debajo repitiendo. */
    titular: diaPerfecto ? pendientesLabel(0) : TITULAR[estado],
    pendientes,
    pendientesLabel: pendientesLabel(pendientes),
    contexto: contextoHoy(s, caja),
    diaPerfecto,
    soloDecisionCritica: estado === "crisis",
  };
}

/* ── Sección 4 · "Esperando tu visto bueno" ──────────────────────────────────── */

/** Las cards de decisión. El motor 1.2 NO existe, así que —como la propia spec resuelve— la
 *  sección muestra las acciones prioritarias actuales de "qué hacer primero" (✅ hoy en
 *  producción) con su CTA al módulo que corresponde. No se inventa un motor.
 *
 *  Máximo 3 (spec). En crisis, UNA: Ley 10 pide menos interfaz, no más rojo. */
export function decisionesHoy(
  s: DashboardSummaryV2 | null | undefined,
  soloDecisionCritica: boolean,
  lugaresReservados = 0,
): DashboardAction[] {
  const acciones = [...(s?.priority_actions ?? [])].sort((a, b) => a.priority - b.priority);
  const limite = soloDecisionCritica
    ? lugaresReservados > 0
      ? 0
      : 1
    : Math.max(0, 3 - lugaresReservados);
  return acciones.slice(0, limite);
}

/* ── Sección 6 · strip de 4 indicadores ──────────────────────────────────────── */

export interface IndicadorHoy {
  /** Label mono del strip. */
  label: string;
  /** El número ya formateado, o `null` cuando NO SE SABE. */
  valor: string | null;
  /** Una línea de apellido/frescura. Obligatoria cuando `valor` es `null`: un "sin dato" mudo
   *  no se distingue de un bug. */
  detalle: string;
  /** Módulo al que enlaza. `null` = todavía no hay dónde ir. */
  href: string | null;
}

/** Los cuatro indicadores de la spec: Caja hoy · Resultado mes · Te deben · Value Ledger.
 *
 *  El cuarto NO EXISTE. El Value Ledger es de la capa Piloto (Fase 3, `🏗`): no hay endpoint, no
 *  hay dato y no hay número honesto que poner. Se renderiza igual, declarado como hueco, porque
 *  omitirlo en silencio esconde una promesa del diseño; ponerle un número sería inventarlo. */
export function indicadoresHoy(s: DashboardSummaryV2 | null | undefined): IndicadorHoy[] {
  const caja = cajaHoy(s);

  const resultado = s?.operational_result ? parseAmountOrNull(s.operational_result.result) : null;

  const cobranza = s?.overdue_collections;
  const vencido = cobranza ? parseAmountOrNull(cobranza.overdue) : null;
  const total = cobranza ? parseAmountOrNull(cobranza.total_receivable) : null;

  return [
    {
      label: "Caja hoy",
      valor: caja.monto != null ? formatClp(caja.monto) : null,
      detalle:
        caja.monto == null
          ? "Conecta tu banco para verlo"
          : caja.estado === "stale"
            ? "Puede estar desactualizado"
            : caja.estado === "estimated"
              ? "Estimado"
              : "Saldo en tus cuentas",
      href: "/caja",
    },
    {
      label: "Resultado mes",
      valor: resultado != null ? formatClp(resultado) : null,
      detalle: resultado == null ? "Sin resultado del mes todavía" : "Del mes en curso",
      href: "/gestion",
    },
    {
      label: "Te deben",
      valor: vencido != null ? formatClp(vencido) : null,
      /* `overdue: null` es el "no se sabe" DECLARADO del backend (el SII no entrega los
         vencimientos). Un "$0" ahí diría "estás al día" sobre documentos cuya fecha no
         conocemos. Se dice qué falta, y el total por cobrar —que sí se sabe— queda a la vista. */
      detalle:
        vencido == null
          ? total != null
            ? `De ${formatClp(total)} por cobrar · el SII aún no entrega los vencimientos`
            : "El SII aún no entrega los vencimientos"
          : total != null
            ? `Vencido · de ${formatClp(total)} por cobrar`
            : "Vencido",
      href: "/cobrar",
    },
    {
      label: "Value Ledger",
      valor: null,
      detalle: "En preparación · llega con la capa Piloto",
      href: null,
    },
  ];
}
