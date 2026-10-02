import { PayrollSystemOnboardingView } from "@/components/onboarding/payroll-system-view";

/* `/onboarding/remuneraciones` — paso de declaración del sistema de remuneraciones
   (CC-API ADR-0122, post-auth). Gating del flag por el layout. */
export default function OnboardingRemuneracionesPage() {
  return <PayrollSystemOnboardingView />;
}
