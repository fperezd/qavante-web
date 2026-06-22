import { ConnectSiiView } from "@/components/onboarding/connect-sii-view";

/* `/onboarding/conectar-sii` — paso 3 (post-auth, protegido por middleware).
   Gating del flag `onboarding` lo hace el layout del grupo. */
export default function ConectarSiiPage() {
  return <ConnectSiiView />;
}
