import { SignupView } from "@/components/onboarding/signup-view";

/* `/registro` — paso 1 del onboarding (Crear cuenta). Público (pre-auth). El
   gating del flag `onboarding` lo hace el layout del grupo. */
export default function RegistroPage() {
  return <SignupView />;
}
