import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

/* Capa de datos — readiness FINANCIERA del onboarding.

   `GET /api/onboarding/readiness` ya está en prod, pero el bloque `financial` sale
   en el PR de API que acompaña a este (`feat(onboarding): readiness financiera`).
   Mientras ese snapshot no aterrice en `main`, los tipos van a mano y `financial`
   es OPCIONAL — un deploy del front adelantado al de la API tiene que renderizar,
   no romperse. Cuando el snapshot esté sincronizado (`npm run generate:api:sync`),
   esto pasa a `components["schemas"]["OnboardingReadinessResponse"]` y `financial`
   deja de ser opcional. Regla 3 del repo.

   ## Qué mide, y por qué no es `ready`

   `ready` dice si las fuentes están conectadas. `financial` dice **hasta qué
   decisión alcanza lo que ya hay**. Conectar un banco no es algo que alguien
   ejecute mañana; mover una línea sí. El wizard necesita la segunda.

   ## Lo que la UI NO muestra de este payload

   `basis` es material de AUDITORÍA: el peldaño de cálculo y `conservative` no se
   imprimen, igual que no se imprime ninguna etiqueta de confianza. El dueño lee el
   número (`minimumCash`, `daysCovered`) y qué cubre (`covers`). Esa separación es
   la razón de que el nivel de confianza exista en el contrato y no en la pantalla. */

/** Niveles de la escalera, nombrados por la decisión que habilitan. */
export type ReadinessLevel = "arranque" | "piso" | "horizonte" | "palancas" | "nomina_protegida";

/** Peldaño con que se calculó la caja mínima. **Auditoría, no copy.** */
export interface ReadinessBasis {
  rung: string;
  label: string;
  buffer_days: number;
  months_observed: number;
  conservative: boolean;
  daily_essential_outflow: string;
}

/** La única acción que mueve al tenant al nivel siguiente. */
export interface ReadinessNextAction {
  code: string;
  label: string;
  reason: string;
}

export interface FinancialReadiness {
  level: ReadinessLevel;
  level_index: number;
  levels_total: number;
  unlocked_decision: string;
  statement: string;
  covers: string;
  /** null mientras no haya sociedad activa con moneda declarada (no se asume CLP). */
  currency: string | null;
  /** SIEMPRE un monto decimal como string. Nunca ausente, nunca null. */
  minimum_cash: string;
  cash_today: string | null;
  /** Días de GASTO ESENCIAL (nómina, arriendo, lo que no se posterga) que cubre la caja de hoy.
   *  SIEMPRE un entero ≥ 0.
   *
   *  **No es `cash_forecast.days_of_cash`.** El divisor acá es un SUBCONJUNTO del egreso total, así
   *  que esta cifra es estructuralmente más chica y contesta "¿tengo colchón?", no "¿hasta cuándo me
   *  alcanza?". Se llamaba `days_covered` y el nombre no lo decía: tres lecturas distintas venían
   *  compartiendo nombres, y el productor las separó. El valor NO cambió, sólo el nombre. */
  essential_outflow_days_covered: number;
  basis: ReadinessBasis;
  next_action: ReadinessNextAction;
  missing: string[];
  satisfied: string[];
}

export interface OnboardingReadiness {
  ready: boolean;
  deferred_sources?: string[];
  /** Opcional sólo hasta que el snapshot con `financial` aterrice. Ver cabecera. */
  financial?: FinancialReadiness;
}

/** Clave de cache. UNA definición: escribirla literal en otro archivo es como se
 *  colaron antes los bugs de cache del onboarding. */
export const onboardingReadinessKey = ["onboarding", "readiness"] as const;

export function onboardingReadinessQueryOptions(enabled = true) {
  return {
    queryKey: onboardingReadinessKey,
    queryFn: () => api.get<OnboardingReadiness>("/api/onboarding/readiness"),
    enabled,
    retry: false,
    staleTime: 30_000,
  };
}

/** `GET /api/onboarding/readiness`. NO retry: el wizard no espera reintentos. */
export function useOnboardingReadiness(enabled = true) {
  return useQuery(onboardingReadinessQueryOptions(enabled));
}

/** Ruta del panel a la que lleva la acción final de cada nivel.
 *
 *  La acción del último nivel es DECIDIR, no conectar: por eso apunta a Caja, que
 *  es donde el plan se ejecuta. Los niveles intermedios vuelven al hub de
 *  conexiones, que es donde está la fuente que falta. Mapa explícito y no un
 *  `switch` con default: si mañana aparece un nivel nuevo, TypeScript lo exige acá
 *  en vez de mandarlo en silencio a una ruta que no le corresponde. */
export const READINESS_ACTION_ROUTE: Record<ReadinessLevel, string> = {
  arranque: "/onboarding/saldo-apertura",
  piso: "/onboarding/conexiones",
  horizonte: "/onboarding/conexiones",
  palancas: "/configuracion",
  nomina_protegida: "/caja",
};
