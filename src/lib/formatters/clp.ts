export function formatClp(value: number) {
  // No-finito (NaN/Infinity) → guion, no "$NaN"/"$∞" en una cifra financiera.
  if (!Number.isFinite(value)) return "s/d";
  const abs = new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
  /* Negativos: signo menos tipográfico (U+2212) ANTES del símbolo → "−$300.000".
     Intl es-CL rinde "$-300.000" (menos entre $ y número), que se lee peor y se
     confunde con un guion. El menos real se distingue mejor en cifras financieras.

     El signo se decide sobre la MAGNITUD redondeada, no sobre el valor con signo:
     así evita el "−$0" cuando el valor redondea a cero Y empata el criterio de
     mitades de Intl, que redondea alejándose del cero. Con `Math.round(value)`,
     un −0,5 daba −0 (Math.round manda las mitades hacia +∞) y salía "$1" sin el
     menos, mientras Intl ya había redondeado la magnitud a 1. Mismo bug que en
     `formatPct`. */
  return value < 0 && Math.round(Math.abs(value)) !== 0 ? `−${abs}` : abs;
}

/* CLP SIN SÍMBOLO, para grillas tipo Estado de Resultados donde el "$" se repite
   en cada celda y solo agrega ruido (la columna ya dice que son pesos). Redondea
   al peso; el 0 se muestra "0" porque un cero es un valor REAL, no dato faltante
   (para "no se sabe" la celda muestra "s/d" y nunca pasa por acá).

   `signed: false` rinde la MAGNITUD (sin el "−"): lo usan las grillas donde el
   signo lo pone la sección ("Gastos operacionales" ya es negativo, repetir el
   menos en cada celda confunde). Por defecto va con signo. PURO. */
export function formatClpBare(value: number, opts?: { signed?: boolean }): string {
  if (!Number.isFinite(value)) return "s/d";
  /* Redondeo sobre la MAGNITUD, como los otros tres formateadores del módulo. Con
     `Math.round(value)` un −1,5 daba −1 mientras `formatClp` daba −$2: `Math.round` manda
     las mitades hacia +∞ y por eso trata distinto a los negativos. No era sólo el signo,
     era la magnitud, y la grilla del Estado de Resultados escribía un número distinto al
     del resto de la app sobre el mismo valor. */
  const r = Math.sign(value) * Math.round(Math.abs(value));
  // `r === 0` captura también el −0 de `Math.round(-0.4)` → "0", nunca "−0".
  if (r === 0) return "0";
  const sign = opts?.signed === false || r > 0 ? "" : "−";
  return `${sign}${Math.abs(r).toLocaleString("es-CL")}`;
}

/* String-decimal del backend → CLP, devolviendo el string TAL CUAL si no es un
   número. Es la variante defensiva para endpoints cuyo contrato no garantiza el
   formato: mejor mostrar lo que llegó (y que se note) que un "$0" inventado.
   Cuando el contrato SÍ garantiza número, usa `parseAmount` + `formatClp`. */
export function formatClpFromString(raw: string): string {
  const n = Number(raw);
  return Number.isFinite(n) ? formatClp(n) : raw;
}

/* CLP COMPACTO para vistas densas (grillas donde el exacto no cabe): "$1,2M",
   "$980K", "$1.234". El monto EXACTO va aparte (tooltip + detalle), nunca se pierde.
   Para cifras de acción (Caja, movimientos) usar `formatClp` — Fernando prefiere el
   exacto ahí; el compacto es solo un apoyo de escaneo. PURO. */
export function formatClpCompact(value: number): string {
  if (!Number.isFinite(value)) return "s/d";
  const abs = Math.abs(value);
  const sign = value < 0 && Math.round(abs) !== 0 ? "−" : "";
  if (abs >= 1_000_000) {
    /* `abs / 1_000_000` a secas, sin pre-redondear. La versión anterior hacía
       `Math.round(abs / 100_000) / 10` primero, y eso era código muerto: `Intl` con
       `maximumFractionDigits: 1` ya redondea a un decimal sobre la representación decimal
       corta, con el mismo criterio de mitades. Comprobado sobre 300.000 valores ≥ 1M: cero
       diferencias. Se quita porque un pre-redondeo que no hace nada invita a creer que la
       cifra pasa por dos criterios distintos. */
    const s = (abs / 1_000_000).toLocaleString("es-CL", {
      maximumFractionDigits: 1,
    });
    return `${sign}$${s}M`;
  }
  if (abs >= 1_000) {
    return `${sign}$${Math.round(abs / 1_000).toLocaleString("es-CL")}K`;
  }
  return formatClp(value);
}

/* Formateador consciente de la moneda. Regla ratificada por Fernando el 2026-08-25:
     - CLP  → "$1.234"       (punto de miles, SIN decimales) = formatClp.
     - USD  → "US$ 1.234,50" (símbolo, ESPACIO, punto de miles, coma decimal, DOS
       decimales).
     - otras → "EUR 1.234,50" con el mismo patrón símbolo + espacio + número.

   EL ESPACIO NO ES COSMÉTICO. `Intl` con locale es-CL rinde el USD PEGADO
   ("US$1.234,50") y todas las demás monedas SEPARADAS ("EUR 1.234,50"): dos
   layouts distintos para el mismo tipo de dato, en la misma columna. Se normaliza
   sobre `formatToParts` — insertando el separador cuando el símbolo va de prefijo
   y no trae `literal` propio— y no con un replace sobre el string ya armado, que
   dependeria del símbolo concreto de cada moneda.

   Los decimales del USD se MANTIENEN en dos: la decisión del BO fue sobre dónde va
   el símbolo, no sobre tirar los centavos, y un "US$ 270" donde el dato dice 270,40
   pierde plata en pantalla.

   Negativos con el mismo menos tipográfico antes del símbolo ("−US$ 270,40").
   Moneda desconocida/ inválida → formato genérico "COD 1.234,50" (no rompe). */
export function formatMoney(value: number, currency: string | null | undefined): string {
  // No-finito → guion (igual que formatClp) antes de tocar Intl.
  if (!Number.isFinite(value)) return "s/d";
  // `|| "CLP"`: cae a CLP también con string vacío "" (que `?? ` NO captura y
  // rompería `Intl.NumberFormat({currency:""})` con RangeError).
  const cur = (currency || "CLP").toUpperCase();
  if (cur === "CLP") return formatClp(value);
  try {
    const parts = new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: cur,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).formatToParts(Math.abs(value));
    /* Un solo separador entre el símbolo y el número cuando el símbolo va DELANTE
       y el locale no puso ninguno. Si el símbolo fuera sufijo (locales que lo ponen
       al final) no se toca nada: el `literal` ya existe y la condición no aplica.

       Va NBSP ( ) y no un espacio normal por dos razones, y las dos importan:
       es el mismo caracter que ICU ya usa en su propio `literal` para EUR/GBP en
       es-CL —así las monedas quedan con UN layout y no con dos— y además impide
       que una cifra de plata se parta entre el símbolo y el número al final de un
       renglón. */
    const abs = parts
      .map((part, i) =>
        part.type === "currency" && parts[i + 1] && parts[i + 1]!.type !== "literal"
          ? `${part.value} `
          : part.value,
      )
      .join("");
    // Magnitud, no valor con signo: ver la nota de `formatClp` (−0,005 daba "US$0,01").
    return value < 0 && Math.round(Math.abs(value) * 100) !== 0 ? `−${abs}` : abs;
  } catch {
    const n = new Intl.NumberFormat("es-CL", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
    return `${cur} ${n}`;
  }
}
