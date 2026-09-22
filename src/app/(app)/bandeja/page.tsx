import { BandejaAuditLanding } from "@/components/bandeja/bandeja-audit-landing";
import { BandejaV07Live } from "@/components/bandeja/v07/bandeja-v07-live";
import { BandejaScope } from "@/components/bandeja/bandeja-scope";
import { WorkInboxSummary } from "@/components/bandeja/work-inbox-summary";
import { resolveFeatureFlags } from "@/lib/feature-flags";

/**
 * Inicio y Caja son la entrada a la lectura financiera; Bandeja conserva la cola viva de auditoría
 * cuando V07 está habilitada. Con el flag apagado, la landing no inventa conteos ni estados.
 */
type BandejaSearchParams = Promise<{
  tab?: string;
  movimiento?: string;
  legal_entity_id?: string;
}>;

export default async function BandejaPage({ searchParams }: { searchParams: BandejaSearchParams }) {
  const { bandejaV07 } = resolveFeatureFlags();
  const params = await searchParams;
  const tabInicial = params.tab === "clasificar" ? "clasificar" : "conciliar";

  if (bandejaV07) {
    return (
      <BandejaScope initialLegalEntityId={params.legal_entity_id}>
        <WorkInboxSummary />
        <BandejaV07Live tabInicial={tabInicial} movimientoInicial={params.movimiento} />
      </BandejaScope>
    );
  }

  return (
    <BandejaScope initialLegalEntityId={params.legal_entity_id}>
      <WorkInboxSummary />
      <BandejaAuditLanding embedded />
    </BandejaScope>
  );
}
