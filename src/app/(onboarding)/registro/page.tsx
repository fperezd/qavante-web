import { Suspense } from "react";
import { SignupView } from "@/components/onboarding/signup-view";

/* `/registro` — paso 1 del onboarding (Crear cuenta). Público (pre-auth).
   `SignupView` usa `useSearchParams` (?email / ?oauth / ?nombre) → Suspense.
   El gating del flag `onboarding` lo hace el layout del grupo. */
export default function RegistroPage() {
  return (
    <Suspense fallback={null}>
      <SignupView />
    </Suspense>
  );
}
