"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { prevStep, type OnboardingStepId } from "./onboarding-steps";

/** Navega al paso anterior del wizard (mismo orden que la barra de progreso). */
export function useOnboardingBack(stepId: OnboardingStepId): (() => void) | undefined {
  const router = useRouter();
  const prev = prevStep(stepId);
  return React.useMemo(() => (prev ? () => router.push(prev.route) : undefined), [router, prev]);
}
