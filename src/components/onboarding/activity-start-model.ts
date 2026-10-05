/* Modelo del paso "desde cuándo existe cada sociedad" del asistente de arranque. SIN React →
 * testeable sin DOM.
 *
 * El defecto que cierra: el productor ya publica la fecha de inicio declarada por sociedad y su
 * PROCEDENCIA, pero nada en pantalla se lo pedía a la empresa. En palabras del autor del
 * backend: *"sin los puntos 1 y 2 la ausencia queda visible sólo por API y por CI, no en
 * pantalla."* Este archivo arma todo el copy que convierte esa ausencia en algo que el dueño ve.
 *
 * ⚠️ LAS TRES REGLAS QUE MANDAN SOBRE ESTE ARCHIVO
 *
 * 1. **Una fecha heredada no se presenta como declarada.** El contrato distingue tres orígenes
 *    —`declared_by_company`, `inherited_from_backfill`, `platform_default`— y sólo el primero es
 *    una declaración de la empresa. Medido en producción el 2026-10-04: 6 de 6 sociedades
 *    heredadas y cero declaradas, con `1970-01-01` como valor por omisión de la columna. Cada
 *    origen tiene su propio rótulo, su propio tono y su propia frase; ninguno comparte copy.
 * 2. **Nada se pre-llena.** El campo de una sociedad sin declarar nace VACÍO. Ni desde la fecha
 *    heredada, ni desde el alta, ni desde el SII (Fernando rechazó de plano leerla del SII el
 *    2026-10-04). Lo que sí se dice es qué fecha está rigiendo hoy y quién la puso: eso es
 *    divulgar el artefacto, no proponerlo.
 * 3. **Siempre un número con qué cubre.** Ninguna función de acá devuelve una abstención, un
 *    vacío ni un cero mudo: todas devuelven una frase con su cifra y con la descripción de qué
 *    abarca esa cifra. También cuando la cifra es cero.
 *
 * La prosa que el productor manda en `summary` y en `opening_cutoff_overlap.detail` NO se
 * imprime: trae los montos sin formatear (`$175878842.00`) y la casa muestra CLP al peso con
 * separador de miles. El copy se arma acá, con los campos numéricos del contrato.
 */
import { formatCount, concordar } from "@/lib/formatters/count";
import { formatDateLike } from "@/lib/formatters/date";
import { formatMoneyFromDecimalString } from "@/lib/formatters/clp";
import { ApiError } from "@/lib/api/errors";
import { FECHA_DE_INICIO, MES_DESDE_EL_QUE_LEEMOS } from "@/lib/nav-labels";
import {
  DECLARED_BY_COMPANY,
  FABRICATED_SENTINEL,
  type ActivityStartProvenance,
  type LegalEntityActivityStartItem,
  type OnboardingActivityStartResponse,
} from "@/lib/api/onboarding-activity-start";

export { FECHA_DE_INICIO, MES_DESDE_EL_QUE_LEEMOS };

/** CLP desde el string decimal del contrato. Si llegara algo que no es un decimal, se muestra
 *  tal cual: que se note es más honesto que pintar un "$0" inventado. */
export function clp(raw: string): string {
  return formatMoneyFromDecimalString(raw, "CLP") ?? raw;
}

/* ── Procedencia: la diferencia entre un dato y un artefacto ──────────────────────────── */

/** Tono visual. `declarada` y `heredada` NUNCA comparten estilo: que se vean igual es
 *  exactamente la confusión que este paso vino a cerrar. */
export type ProvenanceTone = "declarada" | "heredada";

export interface ProvenanceCopy {
  /** Rótulo corto, el que va en la insignia de la fila. */
  etiqueta: string;
  /** Quién puso la fecha, en una frase, para completar la línea de la fila. */
  autor: string;
  tone: ProvenanceTone;
}

const PROVENANCE_COPY: Record<ActivityStartProvenance, ProvenanceCopy> = {
  declared_by_company: {
    etiqueta: "Declarada por tu empresa",
    autor: "la declaró tu empresa",
    tone: "declarada",
  },
  inherited_from_backfill: {
    etiqueta: "La calculó una carga anterior",
    autor: "la calculó una carga anterior de Qavante, no tu empresa",
    tone: "heredada",
  },
  platform_default: {
    etiqueta: "La puso Qavante por omisión",
    autor: "la puso Qavante por omisión, no tu empresa",
    tone: "heredada",
  },
};

/** Copy de la procedencia. Un valor que el contrato todavía no tiene se lee como HEREDADO,
 *  nunca como declarado: equivocarse hacia "la empresa no la declaró" cuesta un clic;
 *  equivocarse hacia "ya está declarada" deja el artefacto de 1970 pasando por un dato. */
export function provenanceCopy(provenance: string): ProvenanceCopy {
  const conocida = PROVENANCE_COPY[provenance as ActivityStartProvenance] as
    | ProvenanceCopy
    | undefined;
  return conocida ?? PROVENANCE_COPY.platform_default;
}

/* ── La fila de una sociedad ──────────────────────────────────────────────────────────── */

export interface EntityRow {
  id: string;
  nombre: string;
  declarada: boolean;
  etiqueta: string;
  tone: ProvenanceTone;
  /** Valor inicial del campo de fecha. **Vacío si no está declarada** (regla 2). */
  valorInicial: string;
  /** Qué está rigiendo hoy y quién lo puso. Siempre una fecha concreta, nunca un vacío. */
  linea: string;
}

/** Una sociedad → su fila.
 *
 *  Dos salidas bien distintas:
 *
 *  - Declarada: el campo trae la fecha declarada (es el valor que la empresa puso; mostrarlo es
 *    reflejar su propia declaración) y la línea dice desde cuándo rige.
 *  - Sin declarar: el campo va VACÍO y la línea dice qué fecha está rigiendo igual y quién la
 *    puso. El caso de `1970-01-01` se nombra como lo que es: una fecha que afirma que la
 *    empresa existe desde 1970 sin que nadie lo haya declarado. */
export function entityRow(item: LegalEntityActivityStartItem): EntityRow {
  const copy = provenanceCopy(item.provenance);
  const fecha = formatDateLike(item.effective_from);
  const declarada = item.declared && item.provenance === DECLARED_BY_COMPANY;

  if (declarada) {
    return {
      id: item.legal_entity_id,
      nombre: item.legal_name,
      declarada: true,
      etiqueta: copy.etiqueta,
      tone: copy.tone,
      valorInicial: item.effective_from,
      linea: `Su historia se atribuye desde el ${fecha}, y ${copy.autor}.`,
    };
  }

  const fabricada = item.effective_from === FABRICATED_SENTINEL;
  return {
    id: item.legal_entity_id,
    nombre: item.legal_name,
    declarada: false,
    etiqueta: copy.etiqueta,
    tone: copy.tone,
    valorInicial: "",
    linea: fabricada
      ? `Hoy Qavante atribuye su historia desde el ${fecha}: ${copy.autor}, así que esta sociedad figura existiendo desde 1970.`
      : `Hoy Qavante atribuye su historia desde el ${fecha}, pero ${copy.autor}.`,
  };
}

/* ── El censo: cuántas faltan, y con cuánta plata ─────────────────────────────────────── */

/** Cuántas declararon, sobre el total. Siempre los dos números a la vista. */
export function declaredLine(res: OnboardingActivityStartResponse): string {
  const total = res.entities.length;
  const faltan = res.undeclared_count;
  const sociedades = concordar(total, "sociedad", "sociedades");
  const declararon = concordar(total, "declaró", "declararon");
  const existen = concordar(total, "existe", "existen");
  const cabeza = `${formatCount(res.declared_count)} de ${formatCount(total)} ${sociedades} ${declararon} desde cuándo ${existen}`;
  if (faltan === 0) return `${cabeza}.`;
  return `${cabeza}: ${concordar(faltan, "falta", "faltan")} ${formatCount(faltan)}.`;
}

/** La historia que ninguna sociedad alcanza a cubrir, con su desglose por flujo.
 *
 *  Medido en producción el 2026-10-04 para el tenant con fecha heredada: 220 compras en 15
 *  períodos por $175.878.842 y 175 ventas en 12 períodos por $434.357.257. */
export function unattributedLine(res: OnboardingActivityStartResponse): string {
  const u = res.unattributed_history;
  return (
    `Quedan ${formatCount(u.payables_documents)} ${concordar(u.payables_documents, "documento", "documentos")} de compra ` +
    `en ${formatCount(u.payables_periods)} ${concordar(u.payables_periods, "período", "períodos")} por ${clp(u.payables_amount)} ` +
    `y ${formatCount(u.receivables_documents)} de venta en ${formatCount(u.receivables_periods)} ` +
    `${concordar(u.receivables_periods, "período", "períodos")} por ${clp(u.receivables_amount)} ` +
    `sin una sociedad a la que atribuirse.`
  );
}

/** Total de la historia sin atribuir, para el número grande de la tarjeta. */
export function unattributedTotal(res: OnboardingActivityStartResponse): {
  monto: string;
  cobertura: string;
} {
  const u = res.unattributed_history;
  return {
    monto: clp(u.amount),
    cobertura: `${formatCount(u.documents)} ${concordar(u.documents, "documento", "documentos")} de compra y de venta sin sociedad`,
  };
}

/** La excepción de las deudas, hecha visible y **al lado** de lo que sí queda sin atribuir.
 *
 *  Decisión de Fernando (2026-10-04): la fecha de inicio rige para todo SALVO las deudas. Una
 *  deuda viva es exigible hoy sin importar cuándo nació la sociedad, así que esta plata NO
 *  desaparece de la posición aunque la fecha siga sin declarar. Mostrarla acá es lo que vuelve
 *  discutible la excepción en vez de invisible. */
export function liveDebtLine(res: OnboardingActivityStartResponse): string {
  const d = res.live_debt_protected;
  return (
    `${formatCount(d.payables_count)} ${concordar(d.payables_count, "cuenta", "cuentas")} por pagar por ${clp(d.payables_amount)} ` +
    `y ${formatCount(d.receivables_count)} por cobrar por ${clp(d.receivables_amount)} siguen contando en tu posición ` +
    `aunque la fecha no esté declarada: una deuda viva se exige hoy, sin importar cuándo nació la sociedad.`
  );
}

/** Total de la deuda protegida, para el número grande de su tarjeta. */
export function liveDebtTotal(res: OnboardingActivityStartResponse): {
  cuentas: string;
  cobertura: string;
} {
  const d = res.live_debt_protected;
  const cuentas = d.payables_count + d.receivables_count;
  return {
    cuentas: `${formatCount(cuentas)} ${concordar(cuentas, "cuenta", "cuentas")}`,
    cobertura: "por pagar y por cobrar que SIGUEN contando en tu posición",
  };
}

/* ── Las dos fechas que se parecen ────────────────────────────────────────────────────── */

/** Por qué el usuario ve documentos saldados dentro del tramo que pidió mirar.
 *
 *  El caso real de Fernando: importación desde el 2026-03-01 con un corte al 2026-08-31 son
 *  cinco meses en que el corte marcó como saldados documentos del tramo que la empresa pidió
 *  ver. Siempre se imprime el número de meses, también cuando es cero. */
export function overlapLine(res: OnboardingActivityStartResponse): string {
  const o = res.opening_cutoff_overlap;
  const desde = formatDateLike(o.import_start_date);
  const meses = `${formatCount(o.overlap_months)} ${concordar(o.overlap_months, "mes", "meses")}`;

  if (!o.active || o.cutoff_date === null) {
    return `Pediste ver tus datos desde el ${desde} y ningún corte de apertura está aplicado: ${meses} de ese tramo los saldó un corte.`;
  }
  const corte = formatDateLike(o.cutoff_date);
  if (o.overlap_months === 0) {
    return `Pediste ver tus datos desde el ${desde} y tu corte de apertura quedó al ${corte}: ${meses} de ese tramo los saldó el corte, así que las dos fechas no se pisan.`;
  }
  return `Pediste ver tus datos desde el ${desde} y tu corte de apertura quedó al ${corte}: son ${meses} en que el corte marcó como saldados documentos del tramo que pediste mirar.`;
}

/** La diferencia entre las dos declaraciones, dicha en la pantalla y no dejada al lector. */
export const DISTINCION_COPY = {
  inicioTitulo: FECHA_DE_INICIO,
  inicioTexto:
    "Es un hecho histórico de cada sociedad y no tiene tope: si tu empresa partió en 2017, la fecha es de 2017. Manda sobre qué se atribuye a cada sociedad: impuestos, ventas, compras, remuneraciones y clasificación.",
  ventanaTitulo: MES_DESDE_EL_QUE_LEEMOS,
  ventanaTexto:
    "Es la decisión de cuánto traer, y llega hasta seis meses antes de tu registro. Se puede mover sin que la historia de tu empresa cambie. Lo eliges en el paso del SII.",
} as const;

/* ── Lo que puede salir mal, con copy propio ──────────────────────────────────────────── */

/** Fecha que no puede ser una declaración. El productor rechaza `1970-01-01` con un 422; la
 *  pantalla lo caza antes para no gastar un viaje, y con la MISMA razón. */
export function declaracionInvalida(startDate: string): string | null {
  if (startDate.trim() === "") {
    return "Escribe desde cuándo existe esta sociedad para declararla.";
  }
  if (startDate === FABRICATED_SENTINEL) {
    return `El ${formatDateLike(FABRICATED_SENTINEL)} es la fecha que Qavante puso por omisión, no una declaración de tu empresa. Escribe la fecha real desde la que existe esta sociedad.`;
  }
  return null;
}

/** Copy de los fracasos del censo y de la declaración. Cada uno dice qué pasó y qué hacer;
 *  ninguno se queda en que algo falló. */
export function activityStartErrorCopy(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "No pudimos guardar la fecha de inicio. Vuelve a intentarlo.";
  }
  if (error.code === "activity_start_census_scope" || error.status === 409) {
    return "Este recuento cubre todas las sociedades de tu empresa y ahora tienes una sola seleccionada. Cambia el alcance a todas tus empresas para verlas juntas.";
  }
  if (error.status === 403) {
    return "Declarar desde cuándo existe una sociedad lo hace el dueño o un administrador de tu empresa. Pídele a quien tenga ese rol que la declare.";
  }
  if (error.status === 404) {
    return "Esa sociedad ya no pertenece a tu empresa. Vuelve a cargar la pantalla para ver las que sí.";
  }
  if (error.status === 422) {
    return `El ${formatDateLike(FABRICATED_SENTINEL)} es la fecha que Qavante puso por omisión, no una declaración de tu empresa. Escribe la fecha real desde la que existe esta sociedad.`;
  }
  return "No pudimos guardar la fecha de inicio. Vuelve a intentarlo.";
}
