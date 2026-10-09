import { Suspense } from "react";
import { ChoosePlanView } from "@/components/onboarding/choose-plan-view";

export default function OnboardingPlanPage() {
  return (
    <Suspense fallback={null}>
      <ChoosePlanView />
    </Suspense>
  );
}
