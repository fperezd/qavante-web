/* Modelo presentacional del prototipo "Salud" (PULSO + Health Score).
 *
 * PROTOTIPO UX — no cableado a rutas ni a la API. Los tipos son locales al
 * prototipo; cuando CC-API exponga el motor v2 (ADR-0064, issues #492/#495) se
 * reemplazan por los generados desde OpenAPI (regla 3 de CLAUDE.md).
 *
 * El vocabulario de los `label` sigue el §8 "Diccionario de UI" de la spec
 * `docs/scoring/pulso-y-health-score-spec-v1.md`: la pantalla habla el idioma
 * del dueño de pyme (pesos antes que ratios, sin jerga). */

export type PulsoBand = "holgado" | "estable" | "ajustado" | "tenso" | "critico";
export type QhsBand = "muy_sana" | "sana_alertas" | "observacion" | "vulnerable" | "riesgo_alto";
export type DriverTone = "bad" | "warn" | "ok";
export type DecisionVerdict = "si" | "margen_justo" | "todavia_no" | "no_por_ahora";
/** Cuadrante de la matriz PULSO×QHS. */
export type Quadrant = "apreton" | "crecer" | "crisis" | "desangra";

export interface ScoreComponent {
  /** Etiqueta en lenguaje de dueño (ver §8 del diccionario). */
  label: string;
  /** 0–100. */
  value: number;
  /** Peso en el índice, 0–1. */
  weight: number;
}

export interface SaludDriver {
  /** Chip por categoría — nunca el reason code técnico (§8). */
  category: "Impuestos" | "Cobranza" | "Gastos" | "Deuda" | "Concentración" | "Caja";
  tone: DriverTone;
  icon: "tax" | "clock" | "trend" | "shield" | "coins";
  title: string;
  detail: string;
  impact: string;
  cta: string;
}

export interface SaludDecision {
  icon: "person" | "bank" | "box" | "coins";
  title: string;
  verdict: DecisionVerdict;
  verdictLabel: string;
  rule: string;
}

export interface ConfidenceFactor {
  label: string;
  value: number;
}

/** Punto de la proyección diaria de caja (30 días), en millones de CLP. */
export interface CashPoint {
  day: number;
  amount: number;
}

export interface SaludModel {
  tenantName: string;
  asOf: string;

  pulso: {
    score: number;
    band: PulsoBand;
    components: ScoreComponent[];
    /** Proyección diaria de caja a 30 días. */
    cash: CashPoint[];
    /** Umbral "mínimo seguro" en millones. */
    cashMin: number;
    /** Día en que la caja cruza el mínimo (null si no cruza). */
    breachDay: number | null;
    /** Día en que se recupera con el cobro esperado (null si no aplica). */
    recoveryDay: number | null;
    knockoutsActive: boolean;
  };

  qhs: {
    score: number;
    band: QhsBand;
    deltaLabel: string;
    components: ScoreComponent[];
    closingLabel: string;
    nextLabel: string;
  };

  confidence: {
    score: number;
    factors: ConfidenceFactor[];
    note: string;
  };

  /** Cuadrante activo + lectura en una frase. */
  matrix: { active: Quadrant; reading: string };

  /** Serie mensual del Health Score (cierres). */
  trend: { month: string; value: number }[];

  drivers: SaludDriver[];
  decisions: SaludDecision[];
}
