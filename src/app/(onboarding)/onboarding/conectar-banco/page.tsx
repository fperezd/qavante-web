import { ConnectBankView } from "@/components/onboarding/connect-bank-view";
import { CompanyScopeProvider } from "@/components/shell/company-scope";

/* `/onboarding/conectar-banco` — paso 4 (post-auth, protegido por middleware).
   Gating del flag `onboarding` lo hace el layout del grupo. */
export default function ConectarBancoPage() {
  return (
    <CompanyScopeProvider>
      <ConnectBankView />
    </CompanyScopeProvider>
  );
}
