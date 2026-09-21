import { Landmark } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { BancoWorkspace } from "@/components/banco/banco-workspace";

/* Banco (gated `bancoScreen`): productos + bancos conectados a la empresa. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ movement?: string; account?: string }>;
}) {
  const { movement, account } = await searchParams;
  const { bancoScreen, bancoV03 } = resolveFeatureFlags();

  if (!bancoScreen && !bancoV03) {
    return <QavanteEmpty icon={Landmark} title="Banco" description="Muy pronto disponible." />;
  }

  return (
    <BancoWorkspace bancoV03={bancoV03} initialAccountId={account} initialMovementId={movement} />
  );
}
