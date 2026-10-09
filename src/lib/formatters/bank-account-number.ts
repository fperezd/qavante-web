/** Número censurado para UI (`**** **** **** 1234`). Alineado al borde REST `account_number_display`. */

export function bankAccountNumberDisplay(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 4) return null;
  return `**** **** **** ${digits.slice(-4)}`;
}
