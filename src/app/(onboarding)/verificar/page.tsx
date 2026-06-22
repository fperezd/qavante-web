import { Suspense } from "react";
import { VerifyEmailView } from "@/components/onboarding/verify-email-view";

/* `/verificar` — paso 2 del onboarding (Verificar email). Público (pre-auth).
   `VerifyEmailView` usa `useSearchParams` (?token / ?email) → Suspense. El
   gating del flag lo hace el layout del grupo. */
export default function VerificarPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailView />
    </Suspense>
  );
}
