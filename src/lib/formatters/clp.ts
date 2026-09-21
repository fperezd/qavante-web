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

/* Decimal-string del API → moneda, SIN pasar por IEEE-754.

   Algunos contratos financieros publican `Decimal` como string precisamente para
   que el cliente no pierda precisión al leerlo. `Number("9007199254740993")`
   ya cambia la cifra antes de que `Intl` pueda formatearla.

   La precisión del CONTRATO no es la precisión de PANTALLA. Esta variante sólo
   interpreta la SINTAXIS decimal (signo, entero y fracción) y conserva cada dígito
   fraccional recibido: esa es la precisión de contrato, se fija al parsear
   (`exactDecimal`) y no se pierde acá. La precisión de pantalla la fija la MONEDA,
   en `formatMoneyFromDecimalString`: CLP redondea al peso (half-up, en texto), el
   resto redondea a dos decimales. No es un parser para cálculos: el backend sigue
   siendo dueño de la cifra y de toda aritmética. Si llega algo que no es Decimal
   canónico, se devuelve tal cual en vez de inventar cero, redondear o esconder el
   dato. */
type ExactDecimal = {
  negative: boolean;
  integer: string;
  fraction: string | null;
};

function exactDecimal(raw: string): ExactDecimal | null {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(raw.trim());
  if (!match) return null;

  return {
    negative: match[1] === "-",
    // Los ceros de relleno del entero no cambian el valor; la fracción SÍ conserva
    // cada dígito (incluidos ceros finales) — es precisión de CONTRATO. La pantalla
    // redondea esto después, según la moneda (`formatMoneyFromDecimalString`).
    integer: match[2]!.replace(/^0+(?=\d)/, ""),
    fraction: match[3] ?? null,
  };
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function currencyCode(currency: string | null | undefined): string {
  return (currency || "CLP").trim().toUpperCase() || "CLP";
}

/* Decimales por moneda. Regla ratificada por Fernando: CLP sin decimales, UF
   igual que el resto — dos decimales, no cuatro (2026-09-20, a instancia de
   #325: la UF también se muestra con dos, aunque internamente traiga más). */
function decimalPlaces(currency: string | null | undefined): number {
  return currencyCode(currency) === "CLP" ? 0 : 2;
}

/* Suma 1 a un número escrito como dígitos, propagando el acarreo. Sin `Number()`
   ni `BigInt`: la cifra puede exceder 2^53 y ahí cualquier conversión ya miente.
   El índice en `DIGITS` reemplaza la aritmética. */
const DIGITS = "0123456789";

function incrementDigits(digits: string): string {
  const out = digits.split("");
  let i = out.length - 1;
  while (i >= 0) {
    if (out[i] === "9") {
      out[i] = "0";
      i -= 1;
      continue;
    }
    out[i] = DIGITS.charAt(DIGITS.indexOf(out[i]!) + 1);
    break;
  }
  // Acarreo que desbordó por la izquierda: "999" + 1 = "1000".
  return i < 0 ? `1${out.join("")}` : out.join("");
}

/* Redondea la MAGNITUD a `places` decimales, media hacia arriba, operando sobre
   texto. Es el mismo criterio que `formatClp`, que redondea con `Intl` sobre
   `Math.abs(value)` y por defecto aleja las mitades del cero; acá el signo se
   decide después, sobre el resultado ya redondeado. */
function roundDecimalMagnitude(
  integer: string,
  fraction: string | null,
  places: number,
): { integer: string; fraction: string } {
  const digits = fraction ?? "";
  const kept = digits.slice(0, places).padEnd(places, "0");
  const next = digits.charAt(places);
  if (next === "" || next < "5") return { integer, fraction: kept };

  const carried = incrementDigits(`${integer}${kept}`);
  const cut = carried.length - places;
  return {
    integer: carried.slice(0, cut) || "0",
    fraction: carried.slice(cut),
  };
}

function moneyPrefix(currency: string | null | undefined): string {
  const code = currencyCode(currency);
  if (code === "CLP") return "$";
  // El NBSP mantiene símbolo/código y cifra unidos, como `formatMoney`.
  return `${code === "USD" ? "US$" : code}\u00a0`;
}

/**
 * Formatea un decimal exacto del contrato sin convertirlo a `number`.
 * `null`, vacío o sólo espacios se mantienen como ausencia; texto no decimal
 * vuelve literalmente para que la interfaz no afirme una cifra que no recibió.
 *
 * La PRECISIÓN del contrato no es la precisión de la pantalla. El backend publica
 * `str(Decimal)`, así que un residuo de conversión FX llega como
 * "-31016973.362000000000" y un `NUMERIC(18,2)` como "40791386.00" (medido el
 * 2026-09-15 contra la proyección productiva de Tooxs). Mostrarlos literalmente
 * pintaría "$31.016.973,362000000000" en pesos, contra la regla ratificada de CLP
 * sin decimales. Acá se aplica la regla de la MONEDA sobre el string exacto: CLP
 * al peso, el resto a dos decimales (`decimalPlaces`), redondeando en TEXTO para
 * que un entero sobre 2^53 siga saliendo dígito por dígito. El backend sigue siendo dueño de la cifra:
 * esto es presentación, no aritmética de negocio. La cuantización en origen es
 * qavante-api#598; el frontend no depende de que llegue.
 */
export function formatMoneyFromDecimalString(
  raw: string | null | undefined,
  currency: string | null | undefined,
): string | null {
  if (raw == null || raw.trim() === "") return null;

  const decimal = exactDecimal(raw);
  if (!decimal) return raw;

  const places = decimalPlaces(currency);
  const rounded = roundDecimalMagnitude(decimal.integer, decimal.fraction, places);
  const numberText = `${groupThousands(rounded.integer)}${
    places === 0 ? "" : `,${rounded.fraction}`
  }`;
  /* El cero no lleva signo, igual que en `formatClp`: un "-0", un "-0.00" o un
     "-0.4" que redondea a cero son cero en pantalla, y pintar "−$0" sugiere una
     magnitud negativa que la cifra mostrada no tiene. El juicio va sobre los
     dígitos YA redondeados, no sobre los recibidos: con los recibidos, "-0.4"
     habría salido con un menos delante de un "$0". */
  const isZero = !/[1-9]/.test(`${rounded.integer}${rounded.fraction}`);
  const sign = decimal.negative && !isZero ? "−" : "";
  return `${sign}${moneyPrefix(currency)}${numberText}`;
}

/**
 * Determina "no cero" con la misma regla de MONEDA que decide la pantalla: redondea
 * en texto con `roundDecimalMagnitude` (la misma rutina que usa
 * `formatMoneyFromDecimalString`, con los mismos decimales por moneda de
 * `decimalPlaces`) y
 * juzga sobre esos dígitos YA redondeados, nunca sobre un `number` ni sobre los
 * dígitos crudos del Decimal. Así una fracción sub-peso en CLP ("0.36") que la
 * pantalla pinta "$0" también juzga cero acá, en vez de contarse como impacto real.
 * Un valor no canónico no se suprime: mostrarlo es más honesto que convertirlo
 * implícitamente en un impacto cero.
 */
export function isNonZeroDecimalString(
  raw: string | null | undefined,
  currency: string | null | undefined = "CLP",
): boolean {
  if (raw == null || raw.trim() === "") return false;
  const decimal = exactDecimal(raw);
  if (!decimal) return true;
  const places = decimalPlaces(currency);
  const rounded = roundDecimalMagnitude(decimal.integer, decimal.fraction, places);
  return /[1-9]/.test(`${rounded.integer}${rounded.fraction}`);
}

/* String-decimal del backend → CLP, devolviendo el string TAL CUAL si no es un
   número. Es la variante defensiva para endpoints cuyo contrato no garantiza el
   formato: mejor mostrar lo que llegó (y que se note) que un "$0" inventado.
   Cuando el contrato SÍ garantiza número, usa `parseAmount` + `formatClp`. */
/* Defensiva vía `Number()`, para contratos que no garantizan el formato del
   Decimal (hoy: Obligaciones/Pagar, con `NUMERIC(18,2)`). En CLP hoy COINCIDE
   con el exacto: `formatMoneyFromDecimalString` también redondea al peso, así
   que "1140000.00" da "$1.140.000" por las dos rutas. El exacto existe por dos
   razones que `Number()` sí rompe y que esta variante no cubre: enteros sobre
   2^53 (pierde el último dígito) y monedas con centavos (necesita el decimal
   exacto del contrato, no el que aproxima `Number()`). El panel del Decision
   Brief llama al formateador exacto directo por eso, no por la fracción CLP. */
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
  const places = decimalPlaces(cur);
  try {
    const parts = new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: cur,
      minimumFractionDigits: places,
      maximumFractionDigits: places,
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
    const scale = 10 ** places;
    return value < 0 && Math.round(Math.abs(value) * scale) !== 0 ? `−${abs}` : abs;
  } catch {
    // La UF (y cualquier código que Intl no reconozca como ISO-4217) cae acá:
    // `Intl.NumberFormat({currency:"UF"})` lanza porque UF no es ISO-4217.
    const n = new Intl.NumberFormat("es-CL", {
      minimumFractionDigits: places,
      maximumFractionDigits: places,
    }).format(Math.abs(value));
    // Mismo menos tipográfico (U+2212) que la rama ISO de arriba y que `formatClp`;
    // formatear `value` directo acá dejaba pasar el guion ASCII de Intl sin el
    // criterio de "magnitud redondeada" (un −0,00001 no debe llevar menos).
    const scale = 10 ** places;
    const sign = value < 0 && Math.round(Math.abs(value) * scale) !== 0 ? "−" : "";
    return `${sign}${cur} ${n}`;
  }
}
