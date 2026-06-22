"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useOnboardingStatus } from "@/lib/api/onboarding-status";
import { onboardingResumeRoute } from "./onboarding-steps";

/* Guard del onboarding. Si el flag `onboarding` está ON y el tenant NO completó
   el onboarding, redirige al paso pendiente del wizard (según las fuentes
   conectadas que reporta `status.steps`). NO renderiza UI.

   FAIL-SAFE: solo redirige cuando hay data y `completed === false`. Loading,
   error o flag OFF → NO redirige (nunca atrapa al usuario). Lo monta el
   (app)/layout solo cuando el flag está ON.

   Nota: redirección client-side (hay un flash). Mejora futura: server-side en el
   layout leyendo `onboarding_completed` de `/api/me` (ya en prod) — sin flash.
   Ver onboarding-status-contract.md. */

export function OnboardingGuard() {
  const router = useRouter();
  const status = useOnboardingStatus(true);
  const redirected = React.useRef(false);

  React.useEffect(() => {
    if (redirected.current || !status.data) return;
    if (status.data.completed === false) {
      redirected.current = true;
      const steps = status.data.steps;
      router.replace(
        onboardingResumeRoute(steps?.sii_connected ?? false, steps?.bank_connected ?? false),
      );
    }
  }, [status.data, router]);

  return null;
}
