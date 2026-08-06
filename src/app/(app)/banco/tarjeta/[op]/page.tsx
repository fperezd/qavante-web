import { Landmark } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { currentPeriodSantiago } from "@/components/gestion/gestion-format";
import { TarjetaDetalleLive } from "@/components/banco/tarjeta-detalle-live";

/* Detalle de una tarjeta de crédito de Banco: sus movimientos por mes (`/banco/tarjeta/<op>`). Gated
   `bancoScreen`. Server Component (regla 4): resuelve el flag + calcula el mes actual (Santiago). */
export default async function Page({ params }: { params: Promise<{ op: string }> }) {
  const { bancoScreen } = resolveFeatureFlags();
  const { op } = await params;

  if (!bancoScreen) {
    return <QavanteEmpty icon={Landmark} title="Banco" description="Muy pronto disponible." />;
  }

  return (
    <div className="space-y-6">
      <TarjetaDetalleLive op={decodeURIComponent(op)} mesActual={currentPeriodSantiago(new Date())} />
    </div>
  );
}
