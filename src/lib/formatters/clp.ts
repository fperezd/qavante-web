export function formatClp(value: number) {
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
