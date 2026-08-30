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

   `saltarSi` NO recibe una ventana de líneas. Recibe **la línea del match y el nombre de la
   declaración que la contiene**, y esa decisión es medida, no estética.

   La versión anterior miraba ±4 líneas. Instrumentando el script sobre `src/` salen **30
   descartes vivos**: 26 de la regla de porcentajes y 4 de `LOCALE_ISO`. De los 30, **29 tienen
   la evidencia en la MISMA línea del match** y **exactamente UNO** necesita mirar más lejos:
   `scoreBarWidth` en `pulso-detail-format.ts`, donde el `return \`${clamped}%\`` está tres
   líneas debajo del nombre de su función.

   Las 29 no son todas `style={{ width }}`, aunque la familia se llame "anchos CSS": medido,
   18 traen `width` en la línea, **5 traen `height`**, 2 traen `left` y 4 son fechas `en-CA`
   que no llevan propiedad CSS ninguna.

   O sea que la ventana compraba UN caso, y a cambio abría tres clases de falso negativo
   SILENCIOSO, todas medidas:

     · `<span>Avance: {\`${pct}%\`}</span>` con un `style={{ width }}` en la línea de abajo
       — el porcentaje que el usuario LEE, silenciado por el ancho del div de al lado;
     · `<Chip label={\`Cobertura ${pct}%\`} />` dentro de cualquier bloque con `maxWidth`;
     · un `aria-label` partido en dos líneas por prettier.

   Un guard que se calla es peor que uno que no existe, porque además da confianza.

   El criterio nuevo cubre el caso legítimo por donde de verdad pasa: el IDENTIFICADOR.
   `scoreBarWidth` se descarta porque su función se llama así, no porque haya una palabra
   cerca. Es la justificación que el comentario original daba —"el nombre de su función"— y
   que resultó ser falsa en el código, porque `/\bBarWidth\b/` no matchea `scoreBarWidth`. */
const CSS_NO_ES_CIFRA =
  /\b(width|height|top|left|right|bottom|inset|translate|flexBasis|flex-basis|strokeDash)\b|[A-Za-z]*(Width|Height)\b/i;

/* EL DESCARTE NO GANA SOBRE EL TEXTO QUE EL USUARIO LEE (#49).
   `aria-label`, `title`, `alt` y `placeholder` renderizan como texto —el primero se
   lo lee un lector de pantalla en voz alta—, así que un porcentaje armado a mano ahí
   es exactamente lo que el §5.8 prohíbe, esté al lado de lo que esté.

   Este override existe por un falso negativo VIVO y medido en
   `onboarding/onboarding-shell.tsx`: el `aria-label={`…: ${pct}%`}` de la línea 61 lo
   silenciaba el `style={{ width: `${pct}%` }}` de la línea 65, cuatro más abajo. Las
   dos líneas son del mismo elemento y la ventana no las puede distinguir — una es
   CSS y la otra es lo que oye una persona ciega. Por eso el criterio no es "acortar
   la ventana" sino "mirar la línea del match": ahí sí se ven distintas. */
const TEXTO_AL_USUARIO = /\b(aria-label|aria-valuetext|title|alt|placeholder)\s*=/i;

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

/* ── Los comentarios no son código, y este guard no lo sabía (#49) ────────────
   Este linter matchea sobre el texto crudo del archivo, así que un comentario que
   MENCIONA un patrón cuenta igual que el patrón. Eso rompía las dos direcciones a
   la vez, y las dos están medidas:

     · FALSO POSITIVO — el comentario que explica por qué NO se usa `${x}%` queda
       marcado como si lo usara. Me pasó escribiendo este mismo PR: documenté el
       arreglo de `onboarding-shell` y el guard marcó mi comentario.
     · FALSO NEGATIVO, que es el peor — la VENTANA de descarte lee comentarios como
       si fueran evidencia. El único caso que salvaba a `scoreBarWidth`
       (`pulso-detail-format.ts`) era la palabra "Ancho" de su JSDoc. O sea que el
       descarte dependía de la PROSA, que es literalmente el título del #49.

   `sinComentarios` los reemplaza por espacios en vez de borrarlos: conserva el
   largo y los saltos de línea, así que los índices y los números de línea del
   `matchAll` siguen siendo los del archivo original. Sin eso, cada hallazgo
   reportaría una línea equivocada.

   Reconoce strings y template literals ANTES que comentarios, porque `"https://x"`
   tiene un `//` que no abre nada — sin esa rama, medio archivo desaparecía. No es
   un parser de JS y no pretende serlo: no entiende regex literales (`/foo\/bar/`),
   y una barra de división seguida de otra en una expresión lo confundiría. Es
   deliberado: el precio de equivocarse acá es un descarte de más en un caso raro,
   y la alternativa es un AST, que el #49 descartó por costo para dos casos. */
function sinComentarios(src) {
  let out = "";
  let i = 0;
  const blanco = (t) => t.replace(/[^\n]/g, " ");
  /* ¿El `/` en esta posición abre un REGEX LITERAL o es una división?
     Heurística estándar y conservadora: un regex sólo puede aparecer donde se espera un
     VALOR, así que se mira el último carácter significativo anterior. Si es un operador, una
     apertura, una coma o una palabra clave (`return`, `typeof`, `case`), lo que sigue es un
     valor → regex. Si es un identificador, un número o un cierre, es división.

     Existe porque el pase §6 encontró el caso vivo: `libro-kpis-format.ts:58` tiene
     `return /[";\r\n]/.test(s)`, y la `"` de adentro del regex abría un string fantasma que
     se comía el backtick de la línea siguiente y dejaba sin blanquear el JSDoc de más abajo.
     No es teórico: estaba pasando hoy. */
  /* EL COSTO DE ESTE SET, escrito para no descubrirlo de nuevo. `<` y `}` estan porque
     abren valor de verdad (`a < /re/`, `${x} /re/`), pero eso implica que un cierre de tag
     JSX y una interpolacion tambien entran en modo regex. Cuando la heuristica se equivoca,
     el precio es que un comentario DE ESA MISMA LINEA sobreviva sin blanquear — y como el
     descarte mira la linea del match, un comentario sobreviviente que diga `width` SILENCIA
     un porcentaje real. El pase §6 lo reprodujo con un cierre de tag seguido de un comentario
     de bloque en la misma linea. Cero instancias vivas en los 845 archivos de `src/`, medido,
     y por eso se acepta. */
  const _ANTES_DE_REGEX = new Set("(,=:[!&|?{};+-*%~^<>".split(""));
  /* FRONTERA DE PALABRA OBLIGATORIA a la izquierda. Con `cola.endsWith(w)` pelado, `in`/`of`/
     `case` matcheaban el final de CUALQUIER identificador — `min`, `margin`, `origin`, `join`,
     `admin`, `indexOf`, `lowercase` — y entonces `min / 2` se leia como regex. El pase §6 lo
     reprodujo: una division por `min` seguida en la misma linea de un `//` con la palabra
     `width` pasaba con **exit 0**, porque el modo regex se comia la primera barra del `//` y
     el comentario quedaba como codigo en la linea del match. Silencioso. */
  const _PALABRA_DE_VALOR = /(?:^|[^\w$])(return|typeof|case|in|of|delete|void|yield)$/;
  const abreRegex = (hasta) => {
    let k = hasta - 1;
    while (k >= 0 && /\s/.test(src[k])) k -= 1;
    if (k < 0) return true; // principio del archivo
    if (_ANTES_DE_REGEX.has(src[k])) return true;
    // Palabra clave CON frontera: `return /.../` si, `margin /.../` no.
    return _PALABRA_DE_VALOR.test(src.slice(Math.max(0, k - 8), k + 1));
  };

  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && d !== "/" && d !== "*" && abreRegex(i)) {
      /* Regex literal: se copia entero SIN interpretar comillas ni barras de adentro. Lo que
         hay entre `/` y `/` es sintaxis del patrón, no del programa. */
      let j = i + 1;
      let enClase = false;
      while (j < src.length && src[j] !== "\n") {
        const ch = src[j];
        if (ch === "\\") {
          j += 2;
          continue;
        }
        if (ch === "[") enClase = true;
        else if (ch === "]") enClase = false;
        else if (ch === "/" && !enClase) break;
        j += 1;
      }
      if (j < src.length && src[j] === "/") {
        out += src.slice(i, j + 1);
        i = j + 1;
      } else {
        // No cerró en su línea → no era un regex. Se copia la barra y se sigue.
        out += c;
        i += 1;
      }
    } else if (c === "`") {
      // Template literal: SÍ puede cruzar líneas. Se copia entero.
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === "\\" ? 2 : 1;
      out += src.slice(i, Math.min(j + 1, src.length));
      i = j + 1;
    } else if (c === '"' || c === "'") {
      /* Comilla simple o doble: en JS NO cruzan líneas. Si no encuentra su pareja ANTES del
         próximo `\n`, no era una comilla de apertura — es una comilla dentro de un regex
         literal, un apóstrofo dentro de un template, o texto JSX.

         Sin esta condición el escáner abría un string fantasma y se comía todo hasta la
         siguiente comilla suelta, a veces cientos de líneas más abajo. El pase §6 encontró
         DOS casos vivos en `src/` con esa forma exacta:

           · `libro-kpis-format.ts:58` — `return /[";\r\n]/.test(s)`: la `"` del regex
             abría un fantasma que llegaba hasta el fin del archivo;
           · `tendencia-resultado.tsx:93` — `` `${p.periodo}${anio ? ` '${anio}` : ""}` ``: el
             apóstrofo abría un fantasma de 75 líneas.

         En los dos, los comentarios de la zona NO se blanqueaban — o sea que el tokenizador
         fallaba justo hacia donde no debe: al silencio. */
      const finLinea = src.indexOf("\n", i + 1);
      const limite = finLinea === -1 ? src.length : finLinea;
      let j = i + 1;
      while (j < limite && src[j] !== c) j += src[j] === "\\" ? 2 : 1;
      if (j < limite) {
        out += src.slice(i, j + 1);
        i = j + 1;
      } else {
        // No cierra en su línea → no es un string. Se copia el carácter y se sigue.
        out += c;
        i += 1;
      }
    } else if (c === "/" && d === "*") {
      const fin = src.indexOf("*/", i + 2);
      if (fin === -1) {
        /* Bloque SIN cerrar → no es un comentario. Antes se blanqueaba hasta el fin del
           archivo, así que un `/*` dentro de texto JSX ("margen /* de seguridad") borraba
           todo lo que venía después y el lint se callaba entero. Borrar de más es el peor
           modo de falla que puede tener un guard: no se ve. */
        out += c;
        i += 1;
      } else {
        out += blanco(src.slice(i, fin + 2));
        i = fin + 2;
      }
    } else if (c === "/" && d === "/") {
      let j = src.indexOf("\n", i);
      if (j === -1) j = src.length;
      out += blanco(src.slice(i, j));
      i = j;
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

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
  /* §5.8 y §5.4 miran el CÓDIGO, no la documentación. `src` sigue disponible para
     §5.3 (contar rojo), donde un `text-danger-500` en un comentario tampoco pinta
     nada — pero ahí sólo se reporta, no se falla, así que no vale el riesgo de
     cambiarlo en el mismo PR. */
  const codigo = sinComentarios(src);
  const rel = relative(".", f).split(sep).join("/");
  const lineas = codigo.split(NL);
  const nroLinea = (i) => codigo.slice(0, i).split(NL).length;
  /* La declaración que CONTIENE la línea `n`: se busca hacia arriba el `function X` /
     `const X =` / `class X` más cercano. Es lo que permite descartar `scoreBarWidth` por su
     nombre en vez de por una palabra que pase cerca. */
  /* Sólo declaraciones de FUNCIÓN (o clase), no cualquier `const`. La primera versión
     aceptaba `const X = …` y en `pulso-detail-format.ts` encontraba el `const clamped =
     Math.max(…)` de la línea de arriba en vez de la función que de verdad contiene el
     `return`: devolvía "clamped" y el descarte legítimo se perdía. */
  const _DECL =
    /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s+([A-Za-z_$][\w$]*)|class\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]*)?=\s*(?:async\s*)?(?:\(|function\b|[A-Za-z_$][\w$]*\s*=>))/;
  /* NO HEREDAR UNA HERMANA YA CERRADA (#52).
     La versión anterior devolvía el `_DECL` más cercano hacia arriba SIN mirar si su bloque
     seguía abierto en la línea del match. Cuando el contenedor REAL no matchea `_DECL` —un
     literal de objeto, un `export const COLUMNAS = [`, un método shorthand, el top-level— la
     búsqueda se pasaba de largo y devolvía una función HERMANA YA CERRADA. Como
     `CSS_NO_ES_CIFRA` es `/i` y matchea `…Width`/`…Height`, cualquier `chartWidth`/`getMinHeight`
     arriba en el archivo TAPABA un porcentaje que cayera en un contenedor no reconocido: un
     descarte de más, silencioso — un hallazgo que NO se reporta.

     El arreglo CUENTA LLAVES. El contenedor es la declaración que abre un `{` que sigue SIN
     CERRAR en la línea del match: subiendo desde el match se suma `}` y se resta `{` (ya sin
     comentarios ni strings), y la primera línea que deja el saldo en negativo es la que abrió el
     bloque que nos contiene. Una hermana ya cerrada tiene sus llaves BALANCEADAS en el tramo
     recorrido —abre arriba, cierra antes del match—, así que su saldo vuelve a cero y la
     búsqueda la ignora SOLA. Eso es justo lo que la versión vieja no hacía.

       · si esa línea es un `_DECL` -> ése es el contenedor (p.ej. `scoreBarWidth`);
       · si es un bloque de control (`if`/`for`/…), es transparente —hereda el nombre de su
         propia función—, así que se sigue subiendo;
       · si es cualquier otra cosa —objeto, método shorthand, arrow sin `_DECL`— el contenedor
         real NO es una declaración reconocida y se devuelve `""` en vez de heredar una hermana.

     La línea del match, si ELLA misma es un `_DECL` (arrow de una línea, etc.), gana: el match
     está en su cuerpo por estar en su misma línea.

     Se descartan strings/templates antes de contar porque un `{` dentro de `"{"` o de un
     `` `${x}` `` no es estructura; los `${…}` de un template de una línea igual balancean, así
     que no corrompen el saldo. Sólo se cuentan llaves `{}` —no `()`/`[]`—: son las que delimitan
     cuerpos de función/clase/método/objeto, que es lo único que puede heredar un nombre.

     Sobre `src/` lo que NO cambia es el VEREDICTO: trazados los 42 matches §5.8 con el script
     viejo y con éste, los 42 dan el mismo DESCARTE/REPORTE (baseline 14/14). Lo que sí cambia
     es el NOMBRE que `declaracion` devuelve: de los 30 descartes, 20 pasan a resolver `""` (el
     `%` vive en un objeto/JSX/callback que no es `_DECL`, y antes heredaba el componente:
     `TarjetaCreditoItem`, `AgingCard`, `SaludView`, `OnboardingShell`…), 3 líneas de un mismo
     sitio cambian a su contenedor real (`gestion-seccion-view.tsx:394-396`, `seg` -> `DeCada100`:
     antes heredaban una arrow hermana ya cerrada) y 7 conservan el nombre. Entre los 12 reportes
     cambia uno (`banco-view.tsx:100`, `statusOf` -> `BancoView`), y sigue reportándose. Nada de
     eso mueve un veredicto porque 29 de los 30 descartes traen la evidencia CSS en su propia
     línea; el ÚNICO que depende del nombre es `scoreBarWidth` (medido forzando `declaracion` a
     `""`: 29 descartes, un solo flip). El agujero es latente y se cierra por lo que va a pasar.

     De paso se cierra un FALSO POSITIVO viejo: una arrow hermana `const seg = (x) => {…}` cerrada
     DENTRO de `scoreBarWidth` era el `_DECL` más cercano y el `%` heredaba `seg`, que no es
     CSS -> se reportaba aunque el contenedor real se llamara `…Width`. Con el saldo, `seg` queda
     balanceada y se llega a `scoreBarWidth`.

     CLASE NUEVA DE FALSO POSITIVO, declarada: un `%` dentro de un `useMemo(() => {`, un `.map((v) => {`,
     un `case X: {` o un objeto literal `{` que viven DENTRO de una función legítimamente llamada
     `…Width`/`…Height` ahora se REPORTA (antes lo tapaba el nombre, por la misma herencia), porque
     ese `{` no es `_DECL` ni `_CONTROL` y el saldo corta ahí con `""`. Es ruidoso, no silencioso
     —la dirección que este script prefiere— y lo absorbe el baseline si aparece. Cero instancias
     hoy en `src/` (el único descarte que depende del nombre no tiene callbacks).

     LIMITACIÓN, medida y aceptada como las otras del script: un `class X { m(){ return `${v}%` } }`
     de UNA sola línea todavía hereda `X`, porque el chequeo de la línea del match no cuenta
     llaves intra-línea. Cero instancias en los 845 archivos de `src/`; el caso vivo y realista es
     multilínea, y ése sí se corrige. */
  const _NEUTRAL = /`[^`]*`|"[^"]*"|'[^']*'/g;
  const _CONTROL = /^\s*\}?\s*(?:if|else|for|while|switch|do|try|catch|finally)\b/;
  const saldoLlaves = (linea) => {
    const s = (linea ?? "").replace(_NEUTRAL, "");
    let d = 0;
    for (const ch of s) {
      if (ch === "{") d -= 1;
      else if (ch === "}") d += 1;
    }
    return d;
  };
  const declaracion = (n) => {
    const propia = _DECL.exec(lineas[n - 1] ?? "");
    if (propia) return propia[1] || propia[2] || propia[3] || "";
    let saldo = 0;
    for (let k = n - 2; k >= 0; k -= 1) {
      saldo += saldoLlaves(lineas[k]);
      if (saldo < 0) {
        const linea = lineas[k] ?? "";
        if (_CONTROL.test(linea)) {
          saldo = 0;
          continue;
        }
        const m = _DECL.exec(linea);
        return m ? m[1] || m[2] || m[3] || "" : "";
      }
    }
    return "";
  };
  const contexto = (n) => `${lineas[n - 1] ?? ""}\n${declaracion(n)}`;

  if (!esExento(f)) {
    for (const re of [CARGANDO_STRING, CARGANDO_JSX]) {
      for (const m of codigo.matchAll(re)) {
        anotar(rel, "§5.4", "'Cargando' sin decir qué se espera ni cuánto", nroLinea(m.index));
      }
    }
    for (const { re, que, saltarSi } of FORMATO_AD_HOC) {
      for (const m of codigo.matchAll(re)) {
        const n = nroLinea(m.index);
        /* El override sólo vale contra el descarte CSS. Aplicarlo a todos los `saltarSi`
           lo metía en `LOCALE_ISO`, que existe para no reportar `Intl.DateTimeFormat("en-CA")`
           —el formato con el que se le habla a la API, no al usuario—: un
           `<time title={new Intl.DateTimeFormat("en-CA").format(d)}>` pasaba a reportarse.
           Un falso positivo nuevo en una regla que este trabajo no toca. */
        const puedeAnularse = saltarSi === CSS_NO_ES_CIFRA;
        const enTextoAlUsuario = puedeAnularse && TEXTO_AL_USUARIO.test(lineas[n - 1] ?? "");
        if (saltarSi && !enTextoAlUsuario && saltarSi.test(contexto(n))) continue;
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
