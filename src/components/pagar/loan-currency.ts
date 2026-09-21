/* Moneda del alta de préstamo. PURO/testeable.

   El backend ya acepta cualquier `currency_code` de 3 letras (`CreateLoanRequest`);
   el formulario lo tenía clavado en CLP. Las tres monedas que un crédito PYME chileno
   usa de verdad son peso, UF y dólar — y son códigos del catálogo del sistema
   (`SEED_CURRENCIES`: CLP 0 decimales, UF 4, USD 2), no inventados acá.

   La UF NO es ISO 4217 (Intl no la conoce): `formatMoney` cae a su formato genérico
   "UF 1.234,50", que es correcto para mostrar. */

export type LoanCurrency = "CLP" | "UF" | "USD";

export const LOAN_CURRENCIES: ReadonlyArray<{
  code: LoanCurrency;
  label: string;
  /** Decimales que admite el monto (catálogo del backend). */
  decimals: number;
  placeholder: string;
}> = [
  { code: "CLP", label: "Peso chileno (CLP)", decimals: 0, placeholder: "12.000.000" },
  { code: "UF", label: "Unidad de Fomento (UF)", decimals: 4, placeholder: "1.500,25" },
  { code: "USD", label: "Dólar (USD)", decimals: 2, placeholder: "25.000,50" },
];

export function loanCurrencyMeta(currency: LoanCurrency) {
  return LOAN_CURRENCIES.find((c) => c.code === currency) ?? LOAN_CURRENCIES[0]!;
}

/** Parte entera y decimal de lo tecleado, en notación chilena.

    Acá está la plata: el usuario escribe "25.000,50" y el punto es separador de MILES,
    no decimal. Tratarlo como decimal (normalizar coma→punto y partir por punto)
    convertía US$ 25.000,50 en US$ 25,00 — la primera versión de esta función lo hacía,
    y el test lo agarró. Reglas:
      - Si hay coma, la ÚLTIMA coma es el decimal y todo punto es separador de miles.
      - Si no hay coma, el último punto es decimal salvo que lo sigan exactamente tres
        dígitos ("1.500" es mil quinientos), y aun así es decimal cuando la parte
        entera es sólo "0" ("0.500" es medio, no quinientos).
    `trailing` avisa que el usuario acaba de teclear el separador y todavía no escribe
    los decimales: sin eso, el saneado de cada tecla se comería la coma recién puesta. */
function splitTyped(raw: string): { whole: string; frac: string; trailing: boolean } {
  const s = raw.replace(/[^\d.,]/g, "");
  const lastComma = s.lastIndexOf(",");
  const digitsOnly = (x: string) => x.replace(/\D/g, "");

  if (lastComma >= 0) {
    return {
      whole: digitsOnly(s.slice(0, lastComma)),
      frac: digitsOnly(s.slice(lastComma + 1)),
      trailing: lastComma === s.length - 1,
    };
  }

  const lastDot = s.lastIndexOf(".");
  if (lastDot < 0) return { whole: digitsOnly(s), frac: "", trailing: false };

  const head = digitsOnly(s.slice(0, lastDot));
  const tail = digitsOnly(s.slice(lastDot + 1));
  const esMiles = tail.length === 3 && head !== "0";
  if (esMiles) return { whole: head + tail, frac: "", trailing: false };
  return { whole: head, frac: tail, trailing: lastDot === s.length - 1 };
}

/** Limpia lo tecleado dejando SOLO lo que la moneda admite, **en notación chilena**: el
 *  separador decimal que queda en el estado es la COMA. El peso no lleva decimales; UF y
 *  dólar recortan los que sobran. Se aplica en cada tecla, así que nunca entra al estado un
 *  monto impagable.
 *
 *  La coma no es cosmética, es lo que hace la función IDEMPOTENTE. Con punto decimal, el
 *  propio resultado volvía a entrar acá y `splitTyped` lo releía como separador de miles en
 *  cuanto la fracción tenía tres dígitos: "1500,250" quedaba "1500.250" en el estado y de ahí
 *  salía 1.500.250 — mil veces la plata, camino al backend. Con coma, el punto SIEMPRE es
 *  miles y el resultado de esta función es punto fijo de sí misma (hay test). */
export function sanitizeAmountInput(raw: string, currency: LoanCurrency): string {
  const { decimals } = loanCurrencyMeta(currency);
  if (decimals === 0) return splitTyped(raw).whole;
  const { whole, frac, trailing } = splitTyped(raw);
  const kept = frac.slice(0, decimals);
  if (kept === "") return trailing ? `${whole},` : whole;
  return `${whole},${kept}`;
}

/** Reconversión del monto YA tecleado al cambiar de moneda. Es su propia función y no
 *  un `sanitizeAmountInput` a secas porque ahí "1500.25" pasado a peso daría "150025"
 *  —cien veces la plata, sin que nadie toque el campo—. Acá los decimales que la
 *  moneda nueva no admite se RECORTAN, no se pegan. */
export function retypeAmount(raw: string, to: LoanCurrency): string {
  const { decimals } = loanCurrencyMeta(to);
  const { whole, frac } = splitTyped(raw);
  if (decimals === 0 || frac === "") return whole;
  const kept = frac.slice(0, decimals);
  return kept === "" ? whole : `${whole},${kept}`;
}

/** Monto tecleado → número. Vacío o sólo separador → 0 (el form lo trata como inválido). */
export function parseAmount(raw: string, currency: LoanCurrency): number {
  const clean = sanitizeAmountInput(raw, currency);
  if (clean === "" || clean === ",") return 0;
  // El estado está en notación chilena; a número se va con punto, y sólo acá.
  const n = Number((clean.endsWith(",") ? clean.slice(0, -1) : clean).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Lo que viaja en `principal` (string decimal, como el resto de los montos del
 *  contrato). Se manda con los decimales de la moneda para que el backend no reciba
 *  notación científica ni un float con cola binaria. */
export function principalForApi(raw: string, currency: LoanCurrency): string {
  return parseAmount(raw, currency).toFixed(loanCurrencyMeta(currency).decimals);
}
