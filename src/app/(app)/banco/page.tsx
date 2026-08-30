import { Landmark } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { BancoView } from "@/components/banco/banco-view";
import { BancoV03Live } from "@/components/banco/v03/banco-v03-live";

/* Banco (gated `bancoScreen`): los productos del tenant por banco — cuentas + tarjetas de crédito.
   Sin `export const runtime` (regla 4): el flag resuelve en runtime del Worker. */
export default function Page() {
  const { bancoScreen, bancoV03 } = resolveFeatureFlags();

  /* V03 · Banco (rediseño Fase 2, issue #68) — gated por `bancoV03`, HOY APAGADO. Reemplaza la
     pantalla entera por la vista de la spec ("Tus cuentas y tarjetas"). Con OFF nada de abajo
     cambia (cero regresión). */
  if (bancoV03) {
    return (
      <div className="space-y-6">
        <header>
          <p className="font-rediseno-mono text-[11px] font-semibold tracking-[.12em] text-rediseno-tinta-3 uppercase">
            Banco
          </p>
          <h1 className="mt-1 font-rediseno-serif text-[28px] leading-tight font-medium text-rediseno-tinta">
            Tus cuentas y tarjetas
          </h1>
        </header>
        <BancoV03Live />
      </div>
    );
  }

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
