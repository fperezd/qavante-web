/* Modelo de pasos del wizard de onboarding (Sprint onboarding, ADR-0017). SIN
   React → testeable. La 1ra persona crea su empresa (RUT) y queda owner; luego
   conecta fuentes y trae datos hasta llegar al dashboard.

   Los pasos `pre-auth` corren antes de tener sesión (signup, verificar email);
   los `post-auth` corren ya logueado, scopeados a la empresa activa. El destino
   final (dashboard) NO es un paso del wizard: es la salida.

   Patrón "siempre wizard, con conexiones diferibles" (Fernando 2026-08-12): los
   pasos que conectan una fuente (`source`) son DIFERIBLES — "conectar después"
   avanza el wizard y deja la conexión pendiente en el hub de conexiones. Nada
   bloquea el registro. */

import {
  ONBOARDING_SOURCE_IDS,
  type OnboardingSourceId,
  type OnboardingSourceStates,
} from "@/lib/api/onboarding-sources";

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
  /** Fuente conectable que este paso conecta, si aplica. Los pasos con `source`
   *  son los diferibles ("conectar después"). */
  source?: OnboardingSourceId;
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
    source: "sii",
  },
  {
    id: "connect-bank",
    label: "Conectar banco",
    title: "Conecta tu banco",
    route: "/onboarding/conectar-banco",
    phase: "post-auth",
    source: "bank",
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

/** Hub de conexiones del wizard: punto de retorno para conectar lo que se dejó
    para después. NO es un paso numerado — es la puerta de entrada de vuelta. */
export const ONBOARDING_CONNECTIONS_ROUTE = "/onboarding/conexiones";

/** Ruta del paso que conecta una fuente. */
export function routeForSource(source: OnboardingSourceId): string {
  const step = ONBOARDING_STEPS.find((s) => s.source === source);
  /* Si algún día se agrega una fuente sin paso propio (ej. ERP), el hub sigue
     siendo un destino válido: nunca devolvemos una ruta inexistente. */
  return step?.route ?? ONBOARDING_CONNECTIONS_ROUTE;
}

/** Ruta del wizard a la que reanudar a un usuario con onboarding INCOMPLETO.
    Va al primer paso de fuente que no esté ni conectada ni DIFERIDA; si el
    usuario ya resolvió (conectó o difirió) todas las fuentes, sigue con el rubro
    (primer paso que el status no rastrea). Para el guard.

    Clave del patrón: una fuente `deferred` NO devuelve al usuario a ese paso —
    "conectar después" sería mentira si el wizard lo empujara de vuelta ahí. */
export function onboardingResumeRoute(states: OnboardingSourceStates): string {
  for (const source of ONBOARDING_SOURCE_IDS) {
    if (states[source] === "pending") return routeForSource(source);
  }
  return stepById("industry")!.route;
}

/** Lo que mira el guard antes de sacar al usuario de donde está. Puro →
    testeable sin React ni router. */
export interface OnboardingResumeInput {
  /** No pudimos leer el estado (cargando o error). */
  isUnknown: boolean;
  /** El estado que tenemos quedó viejo: hay (o va a haber) un refetch. */
  isStale: boolean;
  /** El backend confirmó el onboarding completado. */
  completed: boolean;
}

/** ¿Hay que devolver a este usuario al wizard?
 *
 *  Tres candados, todos fail-safe (ante la duda NO se lo mueve):
 *
 *  1. `isUnknown` — sin dato no se toca al usuario.
 *  2. `completed` — si terminó, jamás vuelve al wizard.
 *  3. `isStale` — **el candado que faltaba** (regresión cazada en el review del
 *     PR #935). El `QueryClient` es único para toda la app: la entrada
 *     `completed:false` que dejaron los pasos del wizard sigue en cache cuando
 *     el usuario aterriza en el panel, y el guard la leía en su primer render,
 *     con 0 fetches, mandando de vuelta al wizard a quien acababa de terminarlo.
 *     Exigir dato FRESCO cuesta un tick (react-query ya refetchea lo stale al
 *     montar) y nunca redirige por un dato viejo. */
export function shouldResumeOnboarding(input: OnboardingResumeInput): boolean {
  return !input.isUnknown && !input.isStale && !input.completed;
}
