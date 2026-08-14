"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useOnboardingSources } from "@/lib/api/onboarding-sources";
import { onboardingResumeRoute } from "./onboarding-steps";

/* Guard del onboarding. Si el flag `onboarding` está ON y el tenant NO completó
   el onboarding, redirige al paso pendiente del wizard (según el estado por
   fuente del adaptador: conectada / diferida / pendiente). NO renderiza UI.

   "Siempre wizard, con conexiones diferibles" (Fernando 2026-08-12): una fuente
   que el usuario eligió conectar DESPUÉS no lo devuelve a ese paso — sería
   contradecir su decisión. Solo las `pending` marcan dónde retomar.

   FAIL-SAFE: solo redirige cuando hay data y `completed === false`. Loading,
   error o flag OFF → NO redirige (nunca atrapa al usuario). Lo monta el
   (app)/layout solo cuando el flag está ON.

   Nota: redirección client-side (hay un flash). Mejora futura: server-side en el
   layout leyendo `onboarding_completed` de `/api/me` (ya en prod) — sin flash.
   Ver onboarding-status-contract.md. */

export function OnboardingGuard() {
  const router = useRouter();
  const { states, isUnknown, completed } = useOnboardingSources(true);
  const redirected = React.useRef(false);

  React.useEffect(() => {
    // Sin dato del backend (loading/error) no se toca al usuario: fail-safe.
    if (redirected.current || isUnknown || completed) return;
    redirected.current = true;
    router.replace(onboardingResumeRoute(states));
  }, [states, isUnknown, completed, router]);

  return null;
}
