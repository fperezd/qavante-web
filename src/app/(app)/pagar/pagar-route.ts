export type PagarVariant = "v05" | "v2" | "classic" | "none";

/** Centraliza la precedencia de flags para que un rollback no cambie el contrato financiero. */
export function resolvePagarVariant({
  pagarV05,
  pagarV2,
  accountsPayable,
}: {
  pagarV05: boolean;
  pagarV2: boolean;
  accountsPayable: boolean;
}): PagarVariant {
  if (pagarV05) return "v05";
  if (pagarV2 && accountsPayable) return "v2";
  if (accountsPayable) return "classic";
  return "none";
}
