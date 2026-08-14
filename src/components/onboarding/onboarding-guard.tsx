"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useOnboardingSources } from "@/lib/api/onboarding-sources";
import { onboardingResumeRoute, shouldResumeOnboarding } from "./onboarding-steps";

/* Guard del onboarding. Si el flag `onboarding` está ON y el tenant NO completó
   el onboarding, redirige al paso pendiente del wizard (según el estado por
   fuente del adaptador: conectada / diferida / pendiente). NO renderiza UI.

   "Siempre wizard, con conexiones diferibles" (Fernando 2026-08-12): una fuente
   que el usuario eligió conectar DESPUÉS no lo devuelve a ese paso — sería
   contradecir su decisión. Solo las `pending` marcan dónde retomar.

   FAIL-SAFE: solo redirige con dato PRESENTE, FRESCO y `completed === false`
   (`shouldResumeOnboarding`). Loading, error, dato stale o flag OFF → NO
   redirige (nunca atrapa al usuario). Lo monta el (app)/layout solo con el flag
   ON. El candado de frescura es la corrección del review del PR #935: la cache
   `["onboarding","status"]` es compartida con los pasos del wizard y sobrevive a
   la navegación al panel, así que un dato viejo bastaba para devolver al wizard
   a quien acababa de terminarlo.

   Nota: redirección client-side (hay un flash). Mejora futura: server-side en el
   layout leyendo `onboarding_completed` de `/api/me` (ya en prod) — sin flash.
   Ver onboarding-status-contract.md. */

export function OnboardingGuard() {
  const router = useRouter();
  const { states, isUnknown, isStale, completed } = useOnboardingSources(true);
  const redirected = React.useRef(false);

  /* `states` es un objeto nuevo en cada render (`deriveSourceStates` construye
     uno) → sin memo el efecto se re-dispara en cada render. Depender del destino
     ya calculado (un string) lo deja estable. */
  const resumeRoute = onboardingResumeRoute(states);

  React.useEffect(() => {
    if (redirected.current) return;
    if (!shouldResumeOnboarding({ isUnknown, isStale, completed })) return;
    redirected.current = true;
    router.replace(resumeRoute);
  }, [resumeRoute, isUnknown, isStale, completed, router]);

  return null;
}
