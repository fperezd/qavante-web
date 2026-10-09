import { redirect } from "next/navigation";
import { OnboardingCurrencyView } from "@/components/onboarding/onboarding-currency-view";
import { routeAfter } from "@/components/onboarding/onboarding-steps";
import { resolveFeatureFlags } from "@/lib/feature-flags";

/* `/onboarding/monedas` — primer paso de Datos (post-auth). Misma vista que
   Administración → Monedas. Si `multiCurrency` está OFF, se salta al rubro. */
export default function OnboardingMonedasPage() {
  const { multiCurrency } = resolveFeatureFlags();
  if (!multiCurrency) redirect(routeAfter("currency"));

  return <OnboardingCurrencyView />;
}
