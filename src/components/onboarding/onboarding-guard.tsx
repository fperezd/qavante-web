"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useOnboardingStatus } from "@/lib/api/onboarding-status";
import { stepRouteOrFirst } from "./onboarding-steps";

/* Guard del onboarding. Si el flag `onboarding` está ON y el tenant NO completó
   el onboarding, redirige al paso pendiente del wizard. NO renderiza UI.

   FAIL-SAFE: solo redirige cuando hay data y `completed === false`. Loading,
   error (ej. `/api/onboarding/status` 404 — aún no existe) o flag OFF → NO
   redirige (nunca atrapa al usuario en el wizard). Lo monta el (app)/layout
   (server) pasando `enabled` = flag resuelto en runtime.

   Nota: redirección client-side (hay un flash). Cuando el backend exponga
   `onboarding_completed` en `/api/me`, conviene mover el guard a server-side en
   el layout (sin flash) — ver onboarding-status-contract.md. */

export interface OnboardingGuardProps {
  enabled: boolean;
}

export function OnboardingGuard({ enabled }: OnboardingGuardProps) {
  const router = useRouter();
  const status = useOnboardingStatus(enabled);
  const redirected = React.useRef(false);

  React.useEffect(() => {
    if (!enabled || redirected.current) return;
    if (status.data && status.data.completed === false) {
      redirected.current = true;
      router.replace(stepRouteOrFirst(status.data.current_step));
    }
  }, [enabled, status.data, router]);

  return null;
}
