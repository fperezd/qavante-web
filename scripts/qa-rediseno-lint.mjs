#!/usr/bin/env node
/* Lint de los criterios de aceptación del rediseño (ESPECIFICACION §5).
 *
 * Por qué existe: §5 enumera diez criterios de QA. Ocho se verifican mirando la
 * pantalla y dos leyendo el código — y esos dos son justo los que se degradan
 * solos, porque cada vista nueva vuelve a inventar su formato o su texto de carga.
 * Sin un guard, cada pantalla de la Fase 2 los vuelve a discutir a mano.
 *
 * Este script NO intenta cubrir los diez. Cubre los dos que son mecánicos y
 * REPORTA, sin fallar, uno tercero que admite interpretación. Un lint que se
 * dispara de más pone la cola entera en rojo y termina desactivado, que es peor
 * que no tenerlo — y este proyecto ya tiene el antecedente medido.
 *
 *   §5.4  "Todo estado vacío/carga tiene texto + acción; grep de 'Cargando...'
 *          sin ETA = fallo."                                        -> BLOQUEA
 *   §5.8  "Fechas y montos pasan lint de formato único."            -> BLOQUEA
 *   §5.3  "Máximo un elemento rojo por pantalla."                   -> reporta
 *
 * MODO BASELINE. Los incumplimientos que YA existían quedan anotados en
 * `qa-rediseno-baseline.json` con su CANTIDAD por archivo+regla. Falla si aparece
 * una clave nueva o si una cantidad CRECE. Que baje sólo avisa: fallar ahí pondría
 * `main` en rojo cada vez que un PR arregla algo sin regenerar el baseline, o sea
 * castigaría el arreglo. `--update-baseline` lo regenera.
 *
 * Se cuenta por CANTIDAD y no por número de línea a propósito: con la línea, mover
 * código dentro del mismo archivo contaría como incumplimiento nuevo; sin contar
 * nada, agregar un segundo incumplimiento del mismo tipo en el mismo archivo pasaba
 * gratis. El conteo cierra ese agujero sin la fragilidad del número de línea.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const RAIZ = "src";
const BASELINE = "qa-rediseno-baseline.json";
const EXT = /\.(ts|tsx)$/;
const NL = String.fromCharCode(10);

/* `src/lib/formatters/` es el ÚNICO lugar donde se permite formatear a mano: es el
   formateador central y su trabajo es exactamente ése. Tests y stories quedan fuera
   porque fijan salidas literales a propósito. */
const EXENTOS = [
  join("src", "lib", "formatters") + sep,
  ".test.",
  ".stories.",
  join("src", "test") + sep,
];

function listar(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) listar(p, acc);
    else if (EXT.test(e)) acc.push(p);
  }
  return acc;
}

const esExento = (f) => EXENTOS.some((x) => f.includes(x));

/* ── §5.4 — "Cargando..." desnudo ─────────────────────────────────────────────
   El criterio no prohíbe la palabra: prohíbe la palabra SOLA. "Cargando tus
   movimientos del banco (~10s)" cumple; "Cargando..." no dice qué se espera ni
   cuánto, y es lo que el usuario ve cuando algo se cuelga.

   Dos patrones porque hay dos formas vivas en el repo: el literal en string y el
   texto JSX suelto. La primera versión sólo veía el primero. */
const CARGANDO_STRING = /(["'`])\s*(Cargando|Loading)\s*(\.{3}|…)?\s*\1/g;
const CARGANDO_JSX = /(?<=>)\s*(Cargando|Loading)\s*(\.{3}|…)?\s*(?=<)/g;

/* ── §5.8 — formato único ─────────────────────────────────────────────────────
   Cada patrón es una forma de escribir plata, porcentaje o fecha SIN pasar por
   `src/lib/formatters/`. Se listan explícitos, no por heurística: un lint que
   adivina produce falsos positivos y termina desactivado.

   `saltarSi` recibe la VENTANA de líneas alrededor del match (±4), no sólo la
   línea. Un `${clamped}%` que arma un ancho CSS no tiene la palabra "width" en su
   propia línea, pero sí en el nombre de su función y en su comentario. Mirar sólo
   la línea dejaba viva toda esa familia de falsos positivos. */
const CSS_NO_ES_CIFRA =
  /\b(width|height|top|left|right|bottom|inset|translate|flexBasis|flex-basis|BarWidth|strokeDash|ancho|alto)\b/i;

/* `en-CA` y `sv-SE` rinden ISO (YYYY-MM-DD). No son fechas para el usuario: son el
   formato con el que se le habla a la API. Confundirlos con display es ruido. */
const LOCALE_ISO = /Intl\.DateTimeFormat\(\s*["'](en-CA|sv-SE)["']/;

const FORMATO_AD_HOC = [
  { re: /\btoLocaleDateString\s*\(/g, que: "fecha a mano (toLocaleDateString)" },
  { re: /\btoLocaleTimeString\s*\(/g, que: "hora a mano (toLocaleTimeString)" },
  { re: /\bIntl\.NumberFormat\s*\(/g, que: "número a mano (Intl.NumberFormat)" },
  {
    re: /\bIntl\.DateTimeFormat\s*\(/g,
    que: "fecha a mano (Intl.DateTimeFormat)",
    saltarSi: LOCALE_ISO,
  },
  {
    re: /\.toFixed\s*\(\s*\d\s*\)\s*\}?\s*%/g,
    que: "porcentaje a mano (toFixed + %)",
    saltarSi: CSS_NO_ES_CIFRA,
  },
  { re: /\$\{[^}]*\}\s*%/g, que: "porcentaje interpolado a mano", saltarSi: CSS_NO_ES_CIFRA },
  { re: /toLocaleString\s*\(\s*["']es-CL["']/g, que: "monto a mano (toLocaleString es-CL)" },
  /* `date-fns` es la otra biblioteca de fechas viva en el repo (`credenciales/format.ts`,
     `administracion/users-table.tsx`). El guard no la vela y el comentario de arriba
     presentaba la lista como completa, que es justo el defecto que este PR combate. */
  { re: /from\s+["']date-fns["']/g, que: "fecha a mano (date-fns)" },
];

/* ── §5.3 — rojo por pantalla (SOLO REPORTA) ──────────────────────────────────
   "Máximo un elemento rojo por pantalla" es una propiedad de la pantalla
   RENDERIZADA, y un archivo no es una pantalla: un componente con cinco ramas
   condicionales puede pintar un solo rojo. Por eso cuenta y muestra, y no falla. */
const ROJO = /\b(?:text|bg|border|ring|from|to)-danger-\d{2,3}\b/g;
const ROJO_UMBRAL_REPORTE = 6;

const archivos = listar(RAIZ);
const cuentas = new Map();
const detalle = new Map();
const rojos = [];

function anotar(rel, regla, motivo, linea) {
  const k = rel + " :: " + regla + " :: " + motivo;
  cuentas.set(k, (cuentas.get(k) ?? 0) + 1);
  if (!detalle.has(k)) detalle.set(k, []);
  detalle.get(k).push(linea);
}

for (const f of archivos) {
  const src = readFileSync(f, "utf8");
  const rel = relative(".", f).split(sep).join("/");
  const lineas = src.split(NL);
  const nroLinea = (i) => src.slice(0, i).split(NL).length;
  const ventana = (n) => lineas.slice(Math.max(0, n - 5), n + 4).join(NL);

  if (!esExento(f)) {
    for (const re of [CARGANDO_STRING, CARGANDO_JSX]) {
      for (const m of src.matchAll(re)) {
        anotar(rel, "§5.4", "'Cargando' sin decir qué se espera ni cuánto", nroLinea(m.index));
      }
    }
    for (const { re, que, saltarSi } of FORMATO_AD_HOC) {
      for (const m of src.matchAll(re)) {
        const n = nroLinea(m.index);
        if (saltarSi && saltarSi.test(ventana(n))) continue;
        anotar(rel, "§5.8", que, n);
      }
    }
  }

  const rojo = (src.match(ROJO) || []).length;
  if (rojo >= ROJO_UMBRAL_REPORTE) rojos.push({ archivo: rel, n: rojo });
}

const actuales = Object.fromEntries([...cuentas.entries()].sort());

if (process.argv.includes("--update-baseline")) {
  writeFileSync(BASELINE, JSON.stringify(actuales, null, 2) + NL, "utf8");
  const t = Object.values(actuales).reduce((a, b) => a + b, 0);
  console.log(
    "baseline regenerado: " + t + " incumplimientos en " + Object.keys(actuales).length + " claves",
  );
  process.exit(0);
}

const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : {};
const nuevas = [];
const crecidas = [];
const bajadas = [];

for (const [k, n] of Object.entries(actuales)) {
  const antes = base[k];
  if (antes === undefined) nuevas.push([k, n]);
  else if (n > antes) crecidas.push([k, antes, n]);
  else if (n < antes) bajadas.push([k, antes, n]);
}
for (const k of Object.keys(base)) if (actuales[k] === undefined) bajadas.push([k, base[k], 0]);

const total = Object.values(actuales).reduce((a, b) => a + b, 0);
console.log(
  "QA rediseño §5 — " +
    archivos.length +
    " archivos, " +
    total +
    " incumplimientos en " +
    Object.keys(actuales).length +
    " claves (baseline: " +
    Object.keys(base).length +
    ")",
);
console.log("");

if (rojos.length) {
  console.log(
    "§5.3 · archivos con " + ROJO_UMBRAL_REPORTE + "+ tokens de rojo (informativo, no bloquea):",
  );
  for (const r of rojos.sort((a, b) => b.n - a.n).slice(0, 10)) {
    console.log("   " + r.n + "x  " + r.archivo);
  }
  console.log("");
}

/* Las claves que BAJAN sólo avisan. Ver la nota del encabezado: fallar acá
   castigaría al PR que arregla algo sin regenerar el baseline en el mismo commit. */
if (bajadas.length) {
  console.log("OK: " + bajadas.length + " clave(s) del baseline bajaron o desaparecieron.");
  console.log("  Regeneralo para que el número quede registrado:");
  console.log("      npm run qa:rediseno -- --update-baseline");
  for (const [k, a, b] of bajadas.slice(0, 10)) console.log("   " + a + " -> " + b + "   " + k);
  if (bajadas.length > 10) console.log("   ... y " + (bajadas.length - 10) + " mas");
  console.log("");
}

let fallo = false;

if (nuevas.length) {
  fallo = true;
  console.error("FALLA: " + nuevas.length + " incumplimiento(s) NUEVO(s):");
  console.error("");
  for (const [k, n] of nuevas) {
    console.error("   " + n + "x  " + k + "   (lineas " + detalle.get(k).join(", ") + ")");
  }
  console.error("");
}

if (crecidas.length) {
  fallo = true;
  console.error("FALLA: " + crecidas.length + " incumplimiento(s) que CRECIERON:");
  console.error("");
  for (const [k, a, b] of crecidas) {
    console.error(
      "   " + a + " -> " + b + "   " + k + "   (lineas " + detalle.get(k).join(", ") + ")",
    );
  }
  console.error("");
}

if (fallo) {
  /* La lista se lee del disco, no se escribe a mano: la version anterior mandaba a
     `months` y `amount` cuando todavia no existian, y omitia `rut`. Un mensaje de ayuda
     que apunta a un modulo ausente es el mismo defecto que el lint persigue. */
  const disponibles = readdirSync(join("src", "lib", "formatters"))
    .filter((f) => EXT.test(f) && !f.includes(".test."))
    .map((f) => f.replace(EXT, ""))
    .sort()
    .join(", ");
  console.error("  Los formateadores que existen hoy en src/lib/formatters/: " + disponibles + ".");
  console.error("  Si el caso es legitimo y no cabe en ninguno, agregalo al baseline y");
  console.error("  explica por que en el cuerpo del PR:");
  console.error("      npm run qa:rediseno -- --update-baseline");
  console.error("");
} else {
  console.log("OK: sin incumplimientos nuevos");
}

process.exit(fallo ? 1 : 0);
