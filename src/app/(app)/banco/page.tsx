import { Landmark } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { BancoView } from "@/components/banco/banco-view";

/* Banco (gated `bancoScreen`): los productos del tenant por banco — cuentas + tarjetas de crédito.
   Sin `export const runtime` (regla 4): el flag resuelve en runtime del Worker. */
export default function Page() {
  const { bancoScreen } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Banco</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Tus cuentas y tarjetas de crédito, agrupadas por banco.
        </p>
      </header>

      {bancoScreen ? (
        <BancoView />
      ) : (
        <QavanteEmpty icon={Landmark} title="Banco" description="Muy pronto disponible." />
      )}
    </div>
  );
}
