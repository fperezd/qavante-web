/* Porcentajes — UN solo formato para toda la app.

   Antes de este módulo había 20+ formateos ad-hoc de porcentaje y NINGÚN central.
   Convivían cuatro reglas distintas de decimales (0, 1 fijo, 1 máximo, 2) y dos
   separadores decimales, porque la mitad usaba `toFixed(1)` — que rinde PUNTO
   ("12.5%") — y la otra mitad `toLocaleString("es-CL")` — que rinde coma
   ("12,5%"). El mismo número escrito de dos formas en pantallas vecinas.

   ── LA REGLA DE DECIMALES: máximo 1, sin mínimo ──────────────────────────────
   "12,5%", "12%", "0%".

   Máximo 1 y no 2: acá un porcentaje es siempre una participación o una variación
   sobre plata. El segundo decimal no cambia ninguna decisión del dueño y ensucia
   las tablas densas.

   SIN mínimo (o sea "12%", no "12,0%"): la casa ya decidió no inventar precisión.
   `formatClp` no imprime ",00" sobre un monto entero, y los tests de
   `formatSignedPct` fijan desde hace tiempo que un 0 se muestra "0%" y no "0,0%".
   Un "12,0%" afirma una precisión decimal que el dato normalmente no tiene.

   ── SIGNO ───────────────────────────────────────────────────────────────────
   Negativos con el menos tipográfico U+2212 ANTES del número ("−12,5%"), igual
   que `formatClp` ("−$300.000"). El hyphen-minus que pone `toLocaleString` se
   confunde con un guion en cifras tabulares, y tener "−$300.000" al lado de
   "-12,5%" en la misma fila era justamente la divergencia a matar.

   El "+" de los positivos es OPT-IN (`{ signed: true }`): solo lo llevan las
   VARIACIONES, donde la dirección es la información. Una participación ("23% del
   total") no lleva signo. */

/** Porcentaje ya calculado (12.5 = 12,5%) → texto. No-finito → "s/d".
 *
 *  @param opts.signed  antepone "+" a los positivos (para variaciones).
 *
 *  NO se clampa a [0, 100] a propósito: un margen negativo (mes en pérdida) o una
 *  variación de +240% deben verse como son, no recortados a un rango cómodo. */
export function formatPct(value: number, opts?: { signed?: boolean }): string {
  // No-finito (NaN/Infinity) → guion, no "NaN%" en una cifra financiera.
  if (!Number.isFinite(value)) return "s/d";
  /* `r` NO se usa para imprimir: sirve solo para decidir el SIGNO sobre lo que el
     usuario va a VER. Un −0,04 se muestra "0" y por lo tanto no puede salir como
     "−0%" ni, con `signed`, como "+0%": el signo contradiría al número de al lado.

     Se redondea sobre la MAGNITUD (no sobre el valor con signo) para empatar el
     criterio de mitades de Intl, que redondea alejándose del cero: `Math.round(-0.5)`
     da −0 (hacia +∞), así que un −0,05 quedaba sin signo mientras el display ya
     decía "0,1". */
  const r = Math.sign(value) * (Math.round(Math.abs(value) * 10) / 10);
  const abs = Math.abs(value).toLocaleString("es-CL", { maximumFractionDigits: 1 });
  const sign = r < 0 ? "−" : opts?.signed && r > 0 ? "+" : "";
  return `${sign}${abs}%`;
}
