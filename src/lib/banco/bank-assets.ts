/** Bancos de Chile conectables en Qavante (cartola / movements). */

/** Lista fija de bancos en el widget (mismo orden que Fintoc Chile movements). */
export const CHILE_WIDGET_BANKS = [
  { id: "cl_banco_estado", name: "Banco Estado" },
  { id: "cl_banco_de_chile", name: "Banco de Chile" },
  { id: "cl_banco_santander", name: "Banco Santander" },
  { id: "cl_banco_bci", name: "Banco BCI" },
  { id: "cl_banco_scotiabank", name: "Banco Scotiabank" },
  { id: "cl_banco_itau", name: "Banco Itaú" },
  { id: "cl_banco_bci_360", name: "Banco BCI 360" },
  { id: "cl_banco_bice", name: "Banco BICE" },
  { id: "cl_banco_security", name: "Banco Security" },
] as const;

export const CHILE_MOVEMENT_BANK_IDS = CHILE_WIDGET_BANKS.map((bank) => bank.id);

const WIDGET_BANK_SET = new Set<string>(CHILE_MOVEMENT_BANK_IDS);
const WIDGET_BANK_ORDER = new Map<string, number>(
  CHILE_WIDGET_BANKS.map((bank, index) => [bank.id, index]),
);
const WIDGET_BANK_LABEL = new Map<string, string>(
  CHILE_WIDGET_BANKS.map((bank) => [bank.id, bank.name]),
);

const ALIASES: Record<string, string> = {
  cl_banco_edwards: "cl_banco_de_chile",
  cl_banco_citibank: "cl_banco_de_chile",
  cl_banco_nova: "cl_banco_bci",
  cl_banco_condell: "cl_banco_scotiabank",
};

/** Archivos reales en `public/banks/logo/`. */
const ICON_FILES: Record<string, string> = {
  cl_banco_estado: "logo_banco_estado.png",
  cl_banco_de_chile: "logo_banco_de_chile.png",
  cl_banco_santander: "logo_santander.png",
  cl_banco_bci: "logo_bci.png",
  cl_banco_bci_360: "logo_bci.png",
  cl_banco_scotiabank: "logo_scotiabank.png",
  cl_banco_itau: "logo_itau.png",
  cl_banco_bice: "logo_banco_bice.png",
  cl_banco_security: "logo_banco_security.png",
  cl_banco_falabella: "logo_banco_falabella.png",
  cl_banco_ripley: "logo_banco_ripley.png",
  cl_banco_internacional: "logo_banco_internacional.png",
  cl_banco_consorcio: "logo_consorcio.png",
  cl_banco_coopeuch: "logo_coopeuch.png",
  cl_banco_bbva: "logo_bbva.png",
  cl_banco_hsbc: "logo_hsbc.png",
  cl_banco_paris: "logo_paris.png",
  cl_banco_corpbanca: "logo_corpbanca.png",
  cl_prepago_los_heroes: "logo_prepago_los_heroes.png",
};

const COLORS: Record<string, string> = {
  cl_banco_estado: "#FF6A00",
  cl_banco_de_chile: "#0033A0",
  cl_banco_santander: "#EC0000",
  cl_banco_bci: "#00A3E0",
  cl_banco_bci_360: "#00A3E0",
  cl_banco_scotiabank: "#EC111A",
  cl_banco_itau: "#EC7000",
  cl_banco_bice: "#0B6E6B",
  cl_banco_security: "#0A2E6C",
  cl_banco_falabella: "#007A33",
  cl_banco_ripley: "#E30613",
  cl_banco_consorcio: "#1B4F9C",
  cl_banco_internacional: "#C8102E",
  cl_banco_coopeuch: "#E87722",
  cl_banco_btg_pactual: "#001E60",
};

export function canonicalBankId(institutionId: string, name?: string): string {
  const raw = institutionId.trim().toLowerCase();
  if (ALIASES[raw]) return ALIASES[raw];
  if (COLORS[raw]) return raw;
  if (name) {
    const n = name.toLowerCase();
    if (n.includes("estado")) return "cl_banco_estado";
    if (n.includes("santander")) return "cl_banco_santander";
    if (/bci\s*360|nova/.test(n)) return "cl_banco_bci_360";
    if (/\bbci\b/.test(n)) return "cl_banco_bci";
    if (n.includes("scotia")) return "cl_banco_scotiabank";
    if (/ita[uú]/.test(n)) return "cl_banco_itau";
    if (/\bbice\b/.test(n)) return "cl_banco_bice";
    if (n.includes("security")) return "cl_banco_security";
    if (n.includes("falabella")) return "cl_banco_falabella";
    if (n.includes("ripley")) return "cl_banco_ripley";
    if (n.includes("internacional")) return "cl_banco_internacional";
    if (n.includes("consorcio")) return "cl_banco_consorcio";
    if (n.includes("coopeuch") || n.includes("dale")) return "cl_banco_coopeuch";
    if (n.includes("bbva")) return "cl_banco_bbva";
    if (n.includes("hsbc")) return "cl_banco_hsbc";
    if (n.includes("paris")) return "cl_banco_paris";
    if (n.includes("corpbanca")) return "cl_banco_corpbanca";
    if (n.includes("héroes") || n.includes("heroes")) return "cl_prepago_los_heroes";
    if ((n.includes("chile") || n.includes("edwards")) && !n.includes("central")) {
      return "cl_banco_de_chile";
    }
  }
  return raw;
}

export function isChileConnectableBank(item: {
  id: string;
  country?: string;
  name?: string;
}): boolean {
  const id = item.id.trim().toLowerCase();
  const country = (item.country ?? "cl").trim().toLowerCase();
  if (country && country !== "cl") return false;
  return WIDGET_BANK_SET.has(id);
}

export function widgetChileBanks<T extends { id: string; name: string; country?: string }>(
  rows: T[],
): T[] {
  const byId = new Map<string, T>();
  for (const row of rows) {
    if (!isChileConnectableBank(row)) continue;
    const id = row.id.trim().toLowerCase();
    if (!byId.has(id)) {
      byId.set(id, { ...row, id, name: WIDGET_BANK_LABEL.get(id) ?? row.name });
    }
  }
  return [...byId.values()].sort(
    (a, b) => (WIDGET_BANK_ORDER.get(a.id) ?? 99) - (WIDGET_BANK_ORDER.get(b.id) ?? 99),
  );
}

export function bankBrandColor(institutionId: string, name?: string): string {
  return COLORS[canonicalBankId(institutionId, name)] ?? "#1D5BFF";
}

export function bankInitials(name: string): string {
  const words = name.replace(/banco/gi, "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "B";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0] ?? ""}${words[1]![0] ?? ""}`.toUpperCase();
}

/** PNG en `qavante-web/public/banks/logo/`. */
export function bankIconCandidates(institutionId: string, name?: string): string[] {
  const id = canonicalBankId(institutionId, name);
  const file = ICON_FILES[id];
  const withoutCl = id.replace(/^cl_/, "");
  const withoutBanco = id.replace(/^cl_banco_/, "");
  const unique: string[] = [];
  for (const src of [
    file ? `/banks/logo/${file}` : null,
    `/banks/logo/logo_${withoutCl}.png`,
    `/banks/logo/logo_${withoutBanco}.png`,
    `/banks/${id}.png`,
  ]) {
    if (src && !unique.includes(src)) unique.push(src);
  }
  return unique;
}

export function bankLocalIconSrc(institutionId: string, name?: string): string {
  return bankIconCandidates(institutionId, name)[0] ?? `/banks/logo/logo_banco_estado.png`;
}
