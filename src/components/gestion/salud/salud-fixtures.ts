/* Escenarios de demo para el prototipo "Salud". Datos ficticios. */

import type { SaludModel, CashPoint } from "./salud-model";

function cashCurve(points: [number, number][]): CashPoint[] {
  return points.map(([day, amount]) => ({ day, amount }));
}

/** Escenario central del mockup: empresa sana con la caja apretada por el IVA
 *  y el atraso del cliente principal. */
export const saludApreton: SaludModel = {
  tenantName: "Comercial Andina SpA",
  asOf: "Lun 6 jul 2026 · 08:30",

  pulso: {
    score: 58,
    band: "ajustado",
    components: [
      { label: "Cobertura de pagos", value: 49, weight: 0.4 },
      { label: "Autonomía de caja", value: 62, weight: 0.25 },
      { label: "Días de holgura", value: 58, weight: 0.2 },
      { label: "Calidad de ingresos", value: 78, weight: 0.15 },
    ],
    cash: cashCurve([
      [0, 9.6],
      [2, 9.0],
      [4, 8.7],
      [6, 8.1],
      [8, 7.9],
      [10, 7.8],
      [12, 7.0],
      [14, 4.3],
      [16, 3.6],
      [18, 2.3],
      [20, 1.6],
      [22, 1.2],
      [23, 1.1],
      [24, 9.4],
      [26, 8.9],
      [28, 8.8],
      [30, 8.6],
    ]),
    cashMin: 2.5,
    breachDay: 18,
    recoveryDay: 24,
    knockoutsActive: false,
  },

  qhs: {
    score: 71,
    band: "sana_alertas",
    deltaLabel: "▾ −3 pts vs mayo · 3er mes a la baja",
    components: [
      { label: "Trayectoria", value: 76, weight: 0.25 },
      { label: "Generación de caja", value: 64, weight: 0.25 },
      { label: "Resiliencia", value: 58, weight: 0.2 },
      { label: "Endeudamiento", value: 79, weight: 0.15 },
      { label: "Disciplina de gastos", value: 70, weight: 0.15 },
    ],
    closingLabel: "junio 2026",
    nextLabel: "31 jul",
  },

  confidence: {
    score: 82,
    factors: [
      { label: "Fuentes conectadas", value: 90 },
      { label: "Al día", value: 88 },
      { label: "Clasificación", value: 76 },
      { label: "Cruce cobros-facturas", value: 71 },
      { label: "Historia", value: 80 },
    ],
    note: "Tu punto débil es el cruce entre cobros y facturas: 71%. Conciliá los 14 movimientos pendientes para afinar la proyección de caja.",
  },

  matrix: {
    active: "apreton",
    reading:
      "Hoy estás en apretón pasajero, cerca del límite: la empresa es sana, pero el IVA de julio y el atraso de tu cliente principal aprietan la caja.",
  },

  trend: [
    { month: "Ago 25", value: 66 },
    { month: "Sep 25", value: 68 },
    { month: "Oct 25", value: 71 },
    { month: "Nov 25", value: 73 },
    { month: "Dic 25", value: 72 },
    { month: "Ene 26", value: 75 },
    { month: "Feb 26", value: 76 },
    { month: "Mar 26", value: 75 },
    { month: "Abr 26", value: 74 },
    { month: "May 26", value: 74 },
    { month: "Jun 26", value: 71 },
  ],

  drivers: [
    {
      category: "Impuestos",
      tone: "bad",
      icon: "tax",
      title: "El IVA de junio vence el 20 de julio: $4.180.000",
      detail:
        "IVA de tus ventas $6,9M menos IVA de tus compras $2,7M. Esa semana, entre la caja y los cobros esperados, te faltarían unos $450.000.",
      impact: "Le resta 9 puntos a tu Pulso · el apretón llegaría el día 18",
      cta: "Ver calendario de caja",
    },
    {
      category: "Cobranza",
      tone: "warn",
      icon: "clock",
      title: "Minera Norte concentra el 42% de tus cobros y va 12 días atrasada",
      detail:
        "Siempre te ha pagado bien (a 47 días, el 93% puntual). Este atraso es raro: dos facturas por $8,4M vencidas el 24 de junio.",
      impact:
        "Le resta 6 puntos a tu Resiliencia · ese cobro lo contamos a medias hasta verlo en el banco",
      cta: "Gestionar cobranza",
    },
    {
      category: "Gastos",
      tone: "warn",
      icon: "trend",
      title: "Tu gasto fijo creció 9% en 6 meses; tus cobros, solo 4%",
      detail:
        "Tres suscripciones nuevas y el arriendo reajustado suman $640.000 al mes de gasto que no baja aunque bajen las ventas.",
      impact:
        "Le resta 4 puntos a tu Disciplina de gastos · por cada $100 nuevos que cobras, sumaste $140 de gasto fijo",
      cta: "Revisar gastos fijos",
    },
    {
      category: "Deuda",
      tone: "ok",
      icon: "shield",
      title: "Tu deuda está sana: cuotas al día y bien respaldadas",
      detail:
        "Tu operación genera casi el doble de lo que pagas en cuotas. Crédito Banco BICE con 14 cuotas restantes; sin factoring en 6 meses y sin deuda con Tesorería.",
      impact: "Sostiene 8 puntos de tu Health Score",
      cta: "Ver obligaciones",
    },
  ],

  decisions: [
    {
      icon: "person",
      title: "Contratar a alguien",
      verdict: "margen_justo",
      verdictLabel: "Con margen justo",
      rule: "Generación de caja 64 ✓ · Resiliencia 58 ✓ · Pulso del mes 61 ✓ — todo pasa, pero apenas.",
    },
    {
      icon: "bank",
      title: "Tomar deuda a largo plazo",
      verdict: "si",
      verdictLabel: "Sí",
      rule: "Aun con la cuota nueva, tu caja genera $1,45 por cada $1 de cuota ✓ (mínimo $1,3).",
    },
    {
      icon: "box",
      title: "Invertir en activos",
      verdict: "todavia_no",
      verdictLabel: "Todavía no",
      rule: "Salud 71 ✓ · pero tu respaldo de caja quedaría en 1,2 meses ✗ (mínimo 1,5).",
    },
    {
      icon: "coins",
      title: "Retirar utilidades",
      verdict: "no_por_ahora",
      verdictLabel: "No por ahora",
      rule: "Generación de caja 64 ✗ (mínimo 65) · esperá a cobrar Minera Norte.",
    },
  ],
};

/** Empresa sólida: caja holgada y salud alta. */
export const saludSolida: SaludModel = {
  ...saludApreton,
  tenantName: "Distribuidora del Sur Ltda.",
  pulso: {
    score: 88,
    band: "holgado",
    components: [
      { label: "Cobertura de pagos", value: 92, weight: 0.4 },
      { label: "Autonomía de caja", value: 86, weight: 0.25 },
      { label: "Días de holgura", value: 90, weight: 0.2 },
      { label: "Calidad de ingresos", value: 84, weight: 0.15 },
    ],
    cash: cashCurve([
      [0, 12],
      [6, 11.4],
      [12, 10.8],
      [18, 11.2],
      [24, 10.6],
      [30, 11.9],
    ]),
    cashMin: 2.5,
    breachDay: null,
    recoveryDay: null,
    knockoutsActive: false,
  },
  qhs: {
    score: 86,
    band: "muy_sana",
    deltaLabel: "▴ +2 pts vs mayo · estable hace 6 meses",
    components: [
      { label: "Trayectoria", value: 88, weight: 0.25 },
      { label: "Generación de caja", value: 84, weight: 0.25 },
      { label: "Resiliencia", value: 85, weight: 0.2 },
      { label: "Endeudamiento", value: 90, weight: 0.15 },
      { label: "Disciplina de gastos", value: 82, weight: 0.15 },
    ],
    closingLabel: "junio 2026",
    nextLabel: "31 jul",
  },
  matrix: {
    active: "crecer",
    reading:
      "Estás para crecer e invertir: caja holgada y salud sólida. Es el momento de negociar mejores condiciones y tomar decisiones de crecimiento desde la fuerza.",
  },
  trend: [
    { month: "Ago 25", value: 80 },
    { month: "Sep 25", value: 81 },
    { month: "Oct 25", value: 83 },
    { month: "Nov 25", value: 84 },
    { month: "Dic 25", value: 83 },
    { month: "Ene 26", value: 85 },
    { month: "Feb 26", value: 85 },
    { month: "Mar 26", value: 86 },
    { month: "Abr 26", value: 85 },
    { month: "May 26", value: 84 },
    { month: "Jun 26", value: 86 },
  ],
};

/** Crisis: caja y estructura comprometidas a la vez. */
export const saludCrisis: SaludModel = {
  ...saludApreton,
  tenantName: "Talleres Providencia EIRL",
  pulso: {
    score: 24,
    band: "tenso",
    components: [
      { label: "Cobertura de pagos", value: 18, weight: 0.4 },
      { label: "Autonomía de caja", value: 22, weight: 0.25 },
      { label: "Días de holgura", value: 10, weight: 0.2 },
      { label: "Calidad de ingresos", value: 44, weight: 0.15 },
    ],
    cash: cashCurve([
      [0, 3.2],
      [3, 2.8],
      [6, 2.1],
      [9, 1.4],
      [12, 0.7],
      [15, -0.4],
      [18, -0.9],
      [21, -1.3],
      [24, -0.8],
      [27, -1.1],
      [30, -1.6],
    ]),
    cashMin: 2.5,
    breachDay: 9,
    recoveryDay: null,
    knockoutsActive: true,
  },
  qhs: {
    score: 38,
    band: "riesgo_alto",
    deltaLabel: "▾ −11 pts vs mayo · caída sostenida",
    components: [
      { label: "Trayectoria", value: 32, weight: 0.25 },
      { label: "Generación de caja", value: 28, weight: 0.25 },
      { label: "Resiliencia", value: 30, weight: 0.2 },
      { label: "Endeudamiento", value: 45, weight: 0.15 },
      { label: "Disciplina de gastos", value: 50, weight: 0.15 },
    ],
    closingLabel: "junio 2026",
    nextLabel: "31 jul",
  },
  confidence: {
    score: 58,
    factors: [
      { label: "Fuentes conectadas", value: 70 },
      { label: "Al día", value: 55 },
      { label: "Clasificación", value: 60 },
      { label: "Cruce cobros-facturas", value: 48 },
      { label: "Historia", value: 62 },
    ],
    note: "Confianza media: faltan conciliar movimientos y conectar todas las fuentes. Aun así, la señal de caja negativa es clara y consistente.",
  },
  matrix: {
    active: "crisis",
    reading:
      "Estás en crisis de caja: modo sobrevivencia. La caja y la estructura están comprometidas a la vez — priorizá sueldos, renegociá vencimientos y frená todo compromiso nuevo.",
  },
  trend: [
    { month: "Ago 25", value: 61 },
    { month: "Sep 25", value: 58 },
    { month: "Oct 25", value: 55 },
    { month: "Nov 25", value: 54 },
    { month: "Dic 25", value: 51 },
    { month: "Ene 26", value: 49 },
    { month: "Feb 26", value: 50 },
    { month: "Mar 26", value: 47 },
    { month: "Abr 26", value: 44 },
    { month: "May 26", value: 49 },
    { month: "Jun 26", value: 38 },
  ],
  drivers: [
    {
      category: "Caja",
      tone: "bad",
      icon: "clock",
      title: "Te quedas sin el mínimo seguro en 9 días",
      detail:
        "Con lo que tienes hoy y los cobros esperados, la caja cruza el mínimo el día 9 y no se recupera dentro del mes.",
      impact: "Alerta grave activa · fuerza el estado a Crítico",
      cta: "Ver calendario de caja",
    },
    {
      category: "Deuda",
      tone: "bad",
      icon: "shield",
      title: "La deuda ya no cubre: estás usando factoring para operar",
      detail:
        "En los últimos 4 meses el factoring pasó de ocasional a estructural. Estás financiando la operación con deuda cara.",
      impact: "Le resta 12 puntos a tu Endeudamiento",
      cta: "Ver obligaciones",
    },
    {
      category: "Concentración",
      tone: "warn",
      icon: "trend",
      title: "Un solo cliente explica el 68% de tus ventas y paga tarde",
      detail:
        "Si ese cliente se atrasa un mes más, la caja no aguanta. La dependencia es tu mayor riesgo estructural hoy.",
      impact: "Le resta 8 puntos a tu Resiliencia",
      cta: "Gestionar cobranza",
    },
  ],
  decisions: [
    {
      icon: "person",
      title: "Contratar a alguien",
      verdict: "no_por_ahora",
      verdictLabel: "No por ahora",
      rule: "Generación de caja 28 ✗ · Resiliencia 30 ✗ — la estructura no soporta gasto fijo nuevo.",
    },
    {
      icon: "bank",
      title: "Tomar deuda a largo plazo",
      verdict: "todavia_no",
      verdictLabel: "Con cuidado",
      rule: "Solo si es para reperfilar y bajar la cuota mensual, no para financiar el déficit.",
    },
    {
      icon: "box",
      title: "Invertir en activos",
      verdict: "no_por_ahora",
      verdictLabel: "No",
      rule: "Salud 38 ✗ · toda la caja disponible tiene que ir a sostener la operación.",
    },
    {
      icon: "coins",
      title: "Retirar utilidades",
      verdict: "no_por_ahora",
      verdictLabel: "No",
      rule: "Generación de caja negativa · cualquier retiro acelera el quiebre de caja.",
    },
  ],
};
