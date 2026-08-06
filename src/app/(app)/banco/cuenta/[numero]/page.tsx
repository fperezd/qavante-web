import { Landmark } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { currentPeriodSantiago } from "@/components/gestion/gestion-format";
import { CuentaDetalleLive } from "@/components/banco/cuenta-detalle-live";

/* Detalle de una cuenta corriente de Banco: sus movimientos por mes (`/banco/cuenta/<numeroCuenta>`).
   Gated `bancoScreen`. Server Component (regla 4): resuelve el flag + calcula el mes actual (Santiago)
   para el filtro, así el FE no computa `new Date()` en el render (evita mismatch de hidratación). */
export default async function Page({ params }: { params: Promise<{ numero: string }> }) {
  const { bancoScreen, bancoConciliacion } = resolveFeatureFlags();
  const { numero } = await params;

  if (!bancoScreen) {
    return <QavanteEmpty icon={Landmark} title="Banco" description="Muy pronto disponible." />;
  }

  return (
    <div className="space-y-6">
      <CuentaDetalleLive
        numeroCuenta={decodeURIComponent(numero)}
        mesActual={currentPeriodSantiago(new Date())}
        conciliarEnabled={bancoConciliacion}
      />
    </div>
  );
}
