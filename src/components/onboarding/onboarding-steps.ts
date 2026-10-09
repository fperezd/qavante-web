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
  | "register-companies"
  | "verify-email"
  | "choose-plan"
  | "import-window"
  | "connect-sii"
  | "connect-bank"
  | "currency"
  | "industry"
  | "payroll-system"
  | "opening-balance"
  | "import"
  | "activity-start"
  | "ready";

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
    id: "register-companies",
    label: "Empresas",
    title: "Tus empresas",
    route: "/registro/empresas",
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
    /* Primer paso post-auth (Opción A: plan temprano, pago tardío). Confirma el plan
       elegido en la landing e inicia el trial; el checkout Fintoc va en un paso posterior. */
    id: "choose-plan",
    label: "Tu plan",
    title: "Confirma tu plan",
    route: "/onboarding/plan",
    phase: "post-auth",
  },
  {
    id: "import-window",
    label: "Mes de inicio",
    title: "¿Desde qué mes leemos?",
    route: "/onboarding/mes-inicio",
    phase: "post-auth",
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
    id: "currency",
    label: "Moneda",
    title: "Configura tu moneda",
    route: "/onboarding/monedas",
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
    /* CC-API ADR-0122: la empresa DECLARA su sistema de remuneraciones. No es un paso
       `source` (no conecta nada: declara una decisión, como el rubro), así que no es
       diferible al hub de conexiones; igual se puede omitir y dejarlo pendiente. */
    id: "payroll-system",
    label: "Remuneraciones",
    title: "¿Con qué pagas tus sueldos?",
    route: "/onboarding/remuneraciones",
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
  {
    /* La empresa DECLARA desde cuándo existe cada sociedad. Decisión de Fernando
       (2026-10-04): "Desde la misma fecha de inicio en el onboarding, recuerda que para
       todo es así, salvo para las deudas." Esa fecha ancla la atribución de toda la
       historia de la sociedad —impuestos, ventas, compras, remuneraciones,
       clasificación— salvo la deuda viva, que se exige hoy sin importar cuándo nació.

       NO es el paso de la ventana de importación, aunque se parezcan: ese dice desde
       cuándo IMPORTAR, está acotado a seis meses antes del alta y se elige en
       `import-window` (SII y banco comparten ese mes). Esta fecha es un hecho histórico
       por sociedad y no tiene tope.

       Va DESPUÉS de `import` por la misma razón que la previsualización de un corte: la
       cifra de lo que queda sin atribuir se mide sobre los documentos ya traídos, así que
       antes de importar marcaría cero, y un cero limpio acá se lee como "no queda nada
       que declarar". Declararla después no llega tarde: la fecha se consulta al atribuir,
       no al ingestar, así que repara la historia que ya entró.

       Es un paso de DECLARACIÓN, no de conexión (como el rubro y las remuneraciones): no
       conecta ninguna fuente, así que no es diferible al hub de conexiones. */
    id: "activity-start",
    label: "Inicio de tus sociedades",
    title: "¿Desde cuándo existe cada sociedad?",
    route: "/onboarding/inicio-de-sociedades",
    phase: "post-auth",
  },
  /* El paso que cierra el hueco: conectar fuentes no es una decisión, y el wizard
     terminaba ahí. Acá el usuario ve su PRIMERA cifra accionable —cuánto mantener en
     caja y cuántos días cubre— con la única acción que la mejora. No es un resumen de
     lo que hizo; es lo que puede hacer mañana. */
  {
    id: "ready",
    label: "Tu primera decisión",
    title: "Tu primera decisión",
    route: "/onboarding/listo",
    phase: "post-auth",
  },
] as const;

/** Etapas visibles del wizard (agrupan los {@link ONBOARDING_STEPS} en la UI). */
export interface OnboardingStepGroup {
  id: string;
  label: string;
  steps: readonly OnboardingStepId[];
}

export const ONBOARDING_STEP_GROUPS: readonly OnboardingStepGroup[] = [
  {
    id: "account",
    label: "Cuenta",
    steps: ["signup", "register-companies", "verify-email"],
  },
  {
    id: "plan",
    label: "Plan",
    steps: ["choose-plan"],
  },
  {
    id: "connections",
    label: "Conexiones",
    steps: ["import-window", "connect-sii", "connect-bank"],
  },
  {
    id: "company-data",
    label: "Datos",
    steps: [
      "currency",
      "industry",
      "payroll-system",
      "opening-balance",
      "import",
      "activity-start",
    ],
  },
] as const;

/** Pasos que siguen el wizard pero no se muestran en la barra de etapas (p. ej. cierre). */
export const ONBOARDING_CLOSURE_STEP_IDS: readonly OnboardingStepId[] = ["ready"] as const;

export function isOnboardingClosureStep(id: OnboardingStepId): boolean {
  return ONBOARDING_CLOSURE_STEP_IDS.includes(id);
}

/** Destino al completar el wizard (no es un paso). */
export const ONBOARDING_DONE_ROUTE = "/inicio";

export const TOTAL_ONBOARDING_STEPS = ONBOARDING_STEPS.length;
export const TOTAL_ONBOARDING_GROUPS = ONBOARDING_STEP_GROUPS.length;

/** Índice 0-based del paso; -1 si no existe. */
export function stepIndex(id: OnboardingStepId): number {
  return ONBOARDING_STEPS.findIndex((s) => s.id === id);
}

export function groupIndexForStep(id: OnboardingStepId): number {
  return ONBOARDING_STEP_GROUPS.findIndex((g) => g.steps.includes(id));
}

export function groupForStep(id: OnboardingStepId): OnboardingStepGroup | undefined {
  const i = groupIndexForStep(id);
  return i >= 0 ? ONBOARDING_STEP_GROUPS[i] : undefined;
}

/** Número humano de la etapa (1-based); 0 si no existe. */
export function groupNumber(id: OnboardingStepId): number {
  const i = groupIndexForStep(id);
  return i < 0 ? 0 : i + 1;
}

export type OnboardingGroupStatus = "done" | "active" | "pending";

export function groupStatus(
  group: OnboardingStepGroup,
  activeStepIndex: number,
): OnboardingGroupStatus {
  const first = stepIndex(group.steps[0]!);
  const last = stepIndex(group.steps[group.steps.length - 1]!);
  if (activeStepIndex > last) return "done";
  if (activeStepIndex >= first && activeStepIndex <= last) return "active";
  return "pending";
}

export function stepById(id: OnboardingStepId): OnboardingStep | undefined {
  return ONBOARDING_STEPS.find((s) => s.id === id);
}

/** Paso cuya ruta coincide con `route` (match por prefijo; gana la ruta más específica). */
export function stepByRoute(route: string): OnboardingStep | undefined {
  let best: OnboardingStep | undefined;
  for (const s of ONBOARDING_STEPS) {
    if (route === s.route || route.startsWith(`${s.route}/`)) {
      if (!best || s.route.length > best.route.length) best = s;
    }
  }
  return best;
}

/** Progreso 1-based en porcentaje (paso 1 de 8 → 13, …, 8 de 8 → 100). 0 si no
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

/** Ruta del paso anterior, o null en el primero del wizard. */
export function routeBefore(id: OnboardingStepId): string | null {
  return prevStep(id)?.route ?? null;
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
    (monedas, primer paso de Datos que el status no rastrea). Para el guard.

    Clave del patrón: una fuente `deferred` NO devuelve al usuario a ese paso —
    "conectar después" sería mentira si el wizard lo empujara de vuelta ahí. */
export interface OnboardingResumeOptions {
  /** `true` cuando el tenant ya guardó el mes inicial (`selected_start_date` en import-window). */
  importStartSelected: boolean;
}

export function onboardingResumeRoute(
  states: OnboardingSourceStates,
  options: OnboardingResumeOptions,
): string {
  if (!options.importStartSelected) {
    return stepById("choose-plan")!.route;
  }
  for (const source of ONBOARDING_SOURCE_IDS) {
    if (states[source] === "pending") return routeForSource(source);
  }
  return stepById("currency")!.route;
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
