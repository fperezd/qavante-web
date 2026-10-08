import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { AcuerdoDetalleLive } from "@/components/acuerdos/acuerdo-detalle-live";

/* `/acuerdos/[id]` — ledger completo de un acuerdo (subjects, latest_terms con calendario,
 * events). Server Component; `params` es async en Next 15 (regla 4). */
export default async function AcuerdoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { financialAgreements } = resolveFeatureFlags();
  const { id } = await params;

  return (
    <div className="space-y-6">
      {financialAgreements ? <AcuerdoDetalleLive agreementId={id} /> : <FeatureUnavailableState />}
    </div>
  );
}
