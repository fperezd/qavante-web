/* Modelo de pasos del wizard de onboarding (Sprint onboarding, ADR-0017). SIN
   React → testeable. La 1ra persona crea su empresa (RUT) y queda owner; luego
   conecta fuentes y trae datos hasta llegar al dashboard.

   Los pasos `pre-auth` corren antes de tener sesión (signup, verificar email);
   los `post-auth` corren ya logueado, scopeados a la empresa activa. El destino
   final (dashboard) NO es un paso del wizard: es la salida. */

export type OnboardingStepId =
  | "signup"
  | "verify-email"
  | "connect-sii"
  | "connect-bank"
  | "industry"
  | "opening-balance"
  | "import";

export interface OnboardingStep {
  id: OnboardingStepId;
  /** Etiqueta corta para la barra de progreso. */
  label: string;
  /** Título de la pantalla. */
  title: string;
  /** Ruta del FE. */
  route: string;
  /** `pre-auth` = sin sesión todavía; `post-auth` = logueado. */
  phase: "pre-auth" | "post-auth";
}

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: "signup",
    label: "Crear cuenta",
    title: "Crea tu cuenta",
    route: "/registro",
    phase: "pre-auth",
  },
  {
    id: "verify-email",
    label: "Verificar email",
    title: "Verifica tu correo",
    route: "/verificar",
    phase: "pre-auth",
  },
  {
    id: "connect-sii",
    label: "Conectar SII",
    title: "Conecta el SII",
    route: "/onboarding/conectar-sii",
    phase: "post-auth",
  },
  {
    id: "connect-bank",
    label: "Conectar banco",
    title: "Conecta tu banco",
    route: "/onboarding/conectar-banco",
    phase: "post-auth",
  },
  {
    id: "industry",
    label: "Elegir rubro",
    title: "Elige tu rubro",
    route: "/onboarding/rubro",
    phase: "post-auth",
  },
  {
    id: "opening-balance",
    label: "Saldo de apertura",
    title: "Registra tu saldo de apertura",
    route: "/onboarding/saldo-apertura",
    phase: "post-auth",
  },
  {
    id: "import",
    label: "Traer datos",
    title: "Traemos tus datos",
    route: "/onboarding/sincronizar",
    phase: "post-auth",
  },
] as const;

/** Destino al completar el wizard (no es un paso). */
export const ONBOARDING_DONE_ROUTE = "/inicio";

export const TOTAL_ONBOARDING_STEPS = ONBOARDING_STEPS.length;

/** Índice 0-based del paso; -1 si no existe. */
export function stepIndex(id: OnboardingStepId): number {
  return ONBOARDING_STEPS.findIndex((s) => s.id === id);
}

export function stepById(id: OnboardingStepId): OnboardingStep | undefined {
  return ONBOARDING_STEPS.find((s) => s.id === id);
}

/** Paso cuya ruta coincide con `route` (match por prefijo del pathname). */
export function stepByRoute(route: string): OnboardingStep | undefined {
  return ONBOARDING_STEPS.find((s) => route === s.route || route.startsWith(`${s.route}/`));
}

/** Progreso 1-based en porcentaje (paso 1 de 7 → 14, …, 7 de 7 → 100). 0 si no
    existe el paso. Redondeado a entero. */
export function progressPct(id: OnboardingStepId): number {
  const i = stepIndex(id);
  if (i < 0) return 0;
  return Math.round(((i + 1) / TOTAL_ONBOARDING_STEPS) * 100);
}

/** Número humano del paso (1-based); 0 si no existe. */
export function stepNumber(id: OnboardingStepId): number {
  const i = stepIndex(id);
  return i < 0 ? 0 : i + 1;
}

/** Paso siguiente, o null si es el último. */
export function nextStep(id: OnboardingStepId): OnboardingStep | null {
  const i = stepIndex(id);
  if (i < 0 || i >= ONBOARDING_STEPS.length - 1) return null;
  return ONBOARDING_STEPS[i + 1] ?? null;
}

/** Paso anterior, o null si es el primero. */
export function prevStep(id: OnboardingStepId): OnboardingStep | null {
  const i = stepIndex(id);
  if (i <= 0) return null;
  return ONBOARDING_STEPS[i - 1] ?? null;
}

/** Ruta a la que ir tras completar `id`: el siguiente paso, o el dashboard si
    era el último. */
export function routeAfter(id: OnboardingStepId): string {
  return nextStep(id)?.route ?? ONBOARDING_DONE_ROUTE;
}
