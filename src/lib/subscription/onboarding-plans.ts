/** Planes mostrados en onboarding (alineados a la landing). Sin API todavía. */

export type QavantePlanId = "starter" | "gestion" | "decision";

export interface QavanteOnboardingPlan {
  id: QavantePlanId;
  name: string;
  headline: string;
  priceLabel: string;
  priceNote?: string;
  recommended?: boolean;
  features: readonly string[];
  /** UF en unidades mínimas CLF (4 decimales). `null` = plan gratis, sin checkout Fintoc. */
  fintocClfUnitAmount: number | null;
}

export const QAVANTE_ONBOARDING_PLANS: readonly QavanteOnboardingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    headline: "Comienza a ordenar y entender tu situación financiera.",
    priceLabel: "Gratis",
    features: ["1 empresa", "1 usuario"],
    fintocClfUnitAmount: null,
  },
  {
    id: "gestion",
    name: "Gestión",
    headline: "Gestiona de forma recurrente la operación financiera de tu empresa.",
    priceLabel: "Desde 2,9 UF/mes",
    priceNote: "Equivalente a 2,42 UF/mes con plan anual · usuarios ilimitados",
    features: ["1 empresa incluida", "Usuarios ilimitados"],
    fintocClfUnitAmount: 29_000,
  },
  {
    id: "decision",
    name: "Decisión",
    headline: "Anticipa escenarios y decide con más contexto.",
    priceLabel: "Desde 5,9 UF/mes",
    priceNote: "Equivalente a 4,92 UF/mes con plan anual · usuarios ilimitados",
    recommended: true,
    features: ["1 empresa incluida", "Usuarios ilimitados"],
    fintocClfUnitAmount: 59_000,
  },
] as const;

export function planRequiresFintocCheckout(id: QavantePlanId): boolean {
  return planById(id).fintocClfUnitAmount != null;
}

const PLAN_ALIASES: Record<string, QavantePlanId> = {
  starter: "starter",
  gestion: "gestion",
  gestión: "gestion",
  decision: "decision",
  decisión: "decision",
};

/** Normaliza `?plan=` desde la landing u otras entradas. */
export function planIdFromQuery(raw: string | null | undefined): QavantePlanId | null {
  if (!raw?.trim()) return null;
  const key = raw.trim().toLowerCase();
  return PLAN_ALIASES[key] ?? null;
}

export function planById(id: QavantePlanId): QavanteOnboardingPlan {
  const plan = QAVANTE_ONBOARDING_PLANS.find((p) => p.id === id);
  if (!plan) throw new Error(`Unknown plan: ${id}`);
  return plan;
}
