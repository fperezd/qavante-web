export function formatClp(value: number) {
  // No-finito (NaN/Infinity) → guion, no "$NaN"/"$∞" en una cifra financiera.
  if (!Number.isFinite(value)) return "—";
  const abs = new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
  /* Negativos: signo menos tipográfico (U+2212) ANTES del símbolo → "−$300.000".
     Intl es-CL rinde "$-300.000" (menos entre $ y número), que se lee peor y se
     confunde con un guion. El menos real se distingue mejor en cifras financieras.
     (`Math.round` evita el "−$0" cuando el valor redondea a cero.) */
  return value < 0 && Math.round(value) !== 0 ? `−${abs}` : abs;
}

/* Formateador consciente de la moneda. Regla (pedido de Fernando):
     - CLP  → "$1.234"      (punto de miles, SIN decimales) = formatClp.
     - USD/otras → "US$1.234,50" (punto de miles, coma decimal, DOS decimales,
       símbolo propio) vía locale es-CL.
   Negativos con el mismo menos tipográfico antes del símbolo ("−US$270,40").
   Moneda desconocida/ inválida → formato genérico "COD 1.234,50" (no rompe). */
export function formatMoney(value: number, currency: string | null | undefined): string {
  // No-finito → guion (igual que formatClp) antes de tocar Intl.
  if (!Number.isFinite(value)) return "—";
  // `|| "CLP"`: cae a CLP también con string vacío "" (que `?? ` NO captura y
  // rompería `Intl.NumberFormat({currency:""})` con RangeError).
  const cur = (currency || "CLP").toUpperCase();
  if (cur === "CLP") return formatClp(value);
  try {
    const abs = new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: cur,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(value));
    return value < 0 && Math.round(value * 100) !== 0 ? `−${abs}` : abs;
  } catch {
    const n = new Intl.NumberFormat("es-CL", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
    return `${cur} ${n}`;
  }
}
