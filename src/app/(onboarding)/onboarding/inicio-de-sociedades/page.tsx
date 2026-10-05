import { ActivityStartOnboardingView } from "@/components/onboarding/activity-start-view";

/* `/onboarding/inicio-de-sociedades` — paso del arranque donde la empresa declara desde
   cuándo existe cada sociedad (post-auth). Gating del flag por el layout del grupo. */
export default function OnboardingInicioDeSociedadesPage() {
  return <ActivityStartOnboardingView />;
}
