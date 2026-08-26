/* Tests del lint de §5. El propio lint los pedía a gritos.
 *
 * El pase §6 del PR #45 lo midió: **7 de 7 mutaciones al script salían exit 0** sin que
 * nada las detectara. Borrar un patrón entero, invertir el sentido del trinquete o dejar
 * la ventana de descarte en 0 pasaban en verde. Y el script ya bloquea CI, así que un
 * guard sin guard es exactamente lo que la §13 llama "prosa que no sustituye enforcement".
 *
 * Se testea el script COMO CLI, con un árbol de fixture en un directorio temporal: es la
 * única forma de ejercitar lo que de verdad importa —el exit code y el trinquete del
 * baseline— sin refactorizarlo a módulo sólo para poder testearlo.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPT = resolve("scripts/qa-rediseno-lint.mjs");

let raiz;

/** Corre el lint sobre el fixture y devuelve `{ code, out, err }` SIN tirar. */
function correr(...args) {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, ...args], {
      cwd: raiz,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out, err: "" };
  } catch (e) {
    return { code: e.status ?? 1, out: e.stdout ?? "", err: e.stderr ?? "" };
  }
}

const escribir = (rel, contenido) => {
  const p = join(raiz, rel);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, contenido, "utf8");
};

beforeEach(() => {
  raiz = mkdtempSync(join(tmpdir(), "qa-lint-"));
  /* El script lee `src/lib/formatters/` para armar el mensaje de ayuda: si no existe,
     el fixture no representa al repo. */
  escribir("src/lib/formatters/clp.ts", "export const x = 1;\n");
  escribir("src/lib/formatters/pct.ts", "export const y = 1;\n");
  escribir("src/componentes/limpio.tsx", "export const A = () => <p>hola</p>;\n");
});

afterEach(() => rmSync(raiz, { recursive: true, force: true }));

describe("qa-rediseno-lint — el trinquete", () => {
  it("sin baseline y sin incumplimientos: exit 0", () => {
    const r = correr();
    expect(r.code).toBe(0);
    expect(r.out).toContain("sin incumplimientos nuevos");
  });

  it("un incumplimiento NUEVO falla, y dice cuál y en qué línea", () => {
    escribir("src/componentes/malo.tsx", 'const f = new Intl.NumberFormat("es-CL");\n');
    const r = correr();
    expect(r.code).toBe(1);
    expect(r.err).toContain("NUEVO");
    expect(r.err).toContain("src/componentes/malo.tsx");
    expect(r.err).toContain("Intl.NumberFormat");
  });

  it("el mismo incumplimiento anotado en el baseline NO falla", () => {
    escribir("src/componentes/malo.tsx", 'const f = new Intl.NumberFormat("es-CL");\n');
    expect(correr("--update-baseline").code).toBe(0);
    expect(correr().code).toBe(0);
  });

  /* EL AGUJERO QUE EL PASE §6 ENCONTRÓ Y QUE CERRÓ EL CONTEO. Con el baseline por
     PRESENCIA, llevar un archivo de 1 a 3 violaciones del mismo tipo pasaba gratis. */
  it("si la CANTIDAD crece en un archivo ya anotado, falla", () => {
    escribir("src/componentes/malo.tsx", 'const f = new Intl.NumberFormat("es-CL");\n');
    expect(correr("--update-baseline").code).toBe(0);
    escribir(
      "src/componentes/malo.tsx",
      'const f = new Intl.NumberFormat("es-CL");\nconst g = new Intl.NumberFormat("es-CL");\n',
    );
    const r = correr();
    expect(r.code).toBe(1);
    expect(r.err).toContain("CRECIERON");
  });

  /* El otro lado del mismo compromiso: por eso NO se usa el número de línea en la clave. */
  it("mover el código dentro del mismo archivo NO falla", () => {
    escribir("src/componentes/malo.tsx", 'const f = new Intl.NumberFormat("es-CL");\n');
    expect(correr("--update-baseline").code).toBe(0);
    escribir(
      "src/componentes/malo.tsx",
      '// dos\n// lineas\n// nuevas\nconst f = new Intl.NumberFormat("es-CL");\n',
    );
    expect(correr().code).toBe(0);
  });

  it("que un incumplimiento DESAPAREZCA avisa pero no falla", () => {
    escribir("src/componentes/malo.tsx", 'const f = new Intl.NumberFormat("es-CL");\n');
    expect(correr("--update-baseline").code).toBe(0);
    escribir("src/componentes/malo.tsx", "const f = 1;\n");
    const r = correr();
    expect(r.code).toBe(0);
    expect(r.out).toContain("bajaron o desaparecieron");
  });
});

describe("qa-rediseno-lint — qué mira y qué no", () => {
  it("§5.4 caza el 'Cargando' desnudo, en string y como texto JSX", () => {
    escribir("src/componentes/a.tsx", 'export const A = () => <p>{"Cargando..."}</p>;\n');
    escribir("src/componentes/b.tsx", "export const B = () => <p>Cargando…</p>;\n");
    const r = correr();
    expect(r.code).toBe(1);
    expect(r.err).toContain("src/componentes/a.tsx");
    expect(r.err).toContain("src/componentes/b.tsx");
  });

  it("§5.4 NO caza un 'Cargando' que sí dice qué se espera", () => {
    escribir(
      "src/componentes/c.tsx",
      'export const C = () => <p>{"Cargando tu banco (~10s)"}</p>;\n',
    );
    expect(correr().code).toBe(0);
  });

  /* Los descartes de la familia de anchos CSS. MEDIDO: desactivando `CSS_NO_ES_CIFRA` el
     lint pasa de 14 incumplimientos a 40, o sea que esos 26 descartes son el **65%** de lo
     que se reportaria. La nota vieja decia "26% del baseline" — era un error de unidad, 26
     hallazgos leidos como 26 por ciento, arrastrado desde antes de este trabajo. */
  it("un ancho CSS no es una cifra: no se marca", () => {
    escribir(
      "src/componentes/barra.tsx",
      "export const Barra = ({ pct }: { pct: number }) => (\n  <div style={{ width: `${pct}%` }} />\n);\n",
    );
    expect(correr().code).toBe(0);
  });

  /* EL CASO REAL, y el UNICO de los 28 descartes vivos del repo que no tiene su evidencia
     en la linea del match. En `scoreBarWidth` la palabra esta en el NOMBRE DE LA FUNCION.

     Ya no hay ventana de +-4 lineas. El pase §6 instrumento los 28 descartes: 27 son
     `style={{ width: ... }}` en la misma linea, y este es el otro. La ventana compraba un
     caso y a cambio abria tres clases de falso negativo silencioso, asi que se reemplazo por
     "linea del match + declaracion que la contiene" — que cubre este por donde de verdad
     pasa, el identificador.

     Este test muere si se saca el lookup de la declaracion. */
  it("un ancho CSS cuya pista esta en la FUNCION, no en la linea, tampoco se marca", () => {
    escribir(
      "src/componentes/ancho.ts",
      [
        "/** Ancho de barra (0-100), clampeado. Para los ejes. */",
        "export function scoreBarWidth(score: number): string {",
        "  const n = Number.isFinite(score) ? score : 0;",
        "  const clamped = Math.max(0, Math.min(100, n));",
        "  return `${clamped}%`;",
        "}",
        "",
      ].join(String.fromCharCode(10)),
    );
    expect(correr().code).toBe(0);
  });

  it("`en-CA` es una fecha ISO para la API, no para el usuario: no se marca", () => {
    escribir("src/componentes/iso.ts", 'export const iso = new Intl.DateTimeFormat("en-CA");\n');
    expect(correr().code).toBe(0);
  });

  it("pero `es-CL` en una fecha SÍ se marca", () => {
    escribir("src/componentes/fecha.ts", 'export const f = new Intl.DateTimeFormat("es-CL");\n');
    expect(correr().code).toBe(1);
  });

  it("el formateador central está exento de su propia regla", () => {
    escribir("src/lib/formatters/clp.ts", 'export const f = new Intl.NumberFormat("es-CL");\n');
    expect(correr().code).toBe(0);
  });

  it("tests y stories están exentos: fijan salidas literales a propósito", () => {
    escribir("src/componentes/x.test.ts", 'const f = new Intl.NumberFormat("es-CL");\n');
    escribir("src/componentes/x.stories.tsx", 'const g = new Intl.NumberFormat("es-CL");\n');
    expect(correr().code).toBe(0);
  });

  it("`date-fns` se ve: es la otra biblioteca de fechas viva en el repo", () => {
    escribir("src/componentes/df.ts", 'import { format } from "date-fns";\nexport { format };\n');
    const r = correr();
    expect(r.code).toBe(1);
    expect(r.err).toContain("date-fns");
  });

  /* §5.3 REPORTA, no bloquea: un archivo no es una pantalla. */
  it("el rojo se reporta y NO hace fallar", () => {
    const rojo = Array.from({ length: 8 }, (_, i) => `const c${i} = "text-danger-500";`).join("\n");
    escribir("src/componentes/rojo.tsx", rojo + "\n");
    const r = correr();
    expect(r.code).toBe(0);
    expect(r.out).toContain("tokens de rojo");
  });
});

/* UN TEST POR PATRON. El pase §6 midio que CUATRO de los ocho se podian borrar enteros
   con la suite en verde. Medido hoy sobre el baseline vivo: los OCHO patrones de esta
   tabla cubren 12 de los 14 incumplimientos (los 2 restantes son la regla de `Cargando`,
   que no esta en esta tabla). Borrarlos no era hipotetico: vaciaba casi todo el guard. Cada fila de esta tabla muere si
   se borra su patron. */
const PATRONES = [
  ["toLocaleDateString", 'const d = new Date().toLocaleDateString("es-CL");', "toLocaleDateString"],
  ["toLocaleTimeString", 'const h = new Date().toLocaleTimeString("es-CL");', "toLocaleTimeString"],
  ["Intl.NumberFormat", 'const n = new Intl.NumberFormat("es-CL");', "Intl.NumberFormat"],
  ["Intl.DateTimeFormat", 'const f = new Intl.DateTimeFormat("es-CL");', "Intl.DateTimeFormat"],
  [
    "toFixed + %",
    "export const P = ({ v }: { v: number }) => <span>{v.toFixed(1)}%</span>;",
    "toFixed",
  ],
  [
    "interpolado + %",
    "export const Q = ({ v }: { v: number }) => <span>{`${v}%`}</span>;",
    "interpolado",
  ],
  ["toLocaleString es-CL", 'const m = (1).toLocaleString("es-CL");', "toLocaleString es-CL"],
  [
    "date-fns",
    ['import { format } from "date-fns";', "export { format };"].join(String.fromCharCode(10)),
    "date-fns",
  ],
];

describe("qa-rediseno-lint — cada patron tiene quien lo defienda", () => {
  for (const [nombre, codigo, esperado] of PATRONES) {
    it(`detecta: ${nombre}`, () => {
      const ext = codigo.includes("<") ? "tsx" : "ts";
      escribir(`src/componentes/p.${ext}`, codigo + String.fromCharCode(10));
      const r = correr();
      expect(r.code).toBe(1);
      expect(r.err).toContain(esperado);
    });
  }
});

/* El descarte de anchos CSS estaba cubierto SOLO del lado del falso positivo: ensanchar la
   lista de palabras sobrevivia. Este fija el otro lado — un porcentaje de VERDAD sigue
   marcandose aunque el archivo mencione "width" en otra parte.

   La primera version de este test FALLO, y ensenio la limitacion que el pase §6 habia
   anotado: el fixture usaba `const ancho = 10` y `export { ancho }` a una linea del match,
   y "ancho" ESTABA en la lista de descarte, asi que el porcentaje real quedaba silenciado.

   ESE PARRAFO CERRABA DICIENDO que era "una limitacion conocida y aceptada". Ya no lo es,
   y por eso se corrige junto con el arreglo (#49): `ancho`/`alto` salieron de la lista y
   los comentarios dejaron de contar como evidencia. Lo que queda vivo es bastante mas
   angosto —un IDENTIFICADOR de codigo con `width`/`height` en la linea del match, o en
   el nombre de la declaracion que la contiene, todavia descarta—, y eso es deliberado: es lo que sostiene la familia de anchos CSS, que era el
   65% de lo que se reportaria sin el (40 incumplimientos contra 14, medido). Los describe
   del final fijan las dos mitades. */
describe("qa-rediseno-lint — el descarte de CSS no puede tragarse una cifra real", () => {
  it("un % real se marca aunque el archivo hable de anchos MAS DE 4 LINEAS ARRIBA", () => {
    escribir(
      "src/componentes/lejos.tsx",
      [
        "/* Este componente calcula el width de una barra en otra parte. */",
        "const px = 10;",
        "",
        "",
        "",
        "",
        "",
        "export const R = ({ v }: { v: number }) => <span>{`${v}%`} del total</span>;",
        "export { px };",
        "",
      ].join(String.fromCharCode(10)),
    );
    const r = correr();
    expect(r.code).toBe(1);
    expect(r.err).toContain("interpolado");
  });
});

describe("qa-rediseno-lint — el mensaje de ayuda no puede mentir", () => {
  it("lista los formateadores que existen EN DISCO, no una lista escrita a mano", () => {
    escribir("src/componentes/malo.tsx", 'const f = new Intl.NumberFormat("es-CL");\n');
    escribir("src/lib/formatters/inventado.ts", "export const z = 1;\n");
    const r = correr();
    expect(r.code).toBe(1);
    /* La versión anterior mandaba a `months` y `amount` cuando no existían, y omitía
       `rut`. Éste es el assert que impide que vuelva a desincronizarse. */
    expect(r.err).toContain("clp, inventado, pct");
    expect(r.err).not.toContain("months");
  });
});

/* ── Los comentarios no son codigo (#49) ─────────────────────────────────────────
   El linter matcheaba sobre el texto crudo, asi que un comentario que MENCIONA un
   patron valia igual que el patron. Rompia en las dos direcciones, y las dos estan
   medidas contra el repo real:

     · el comentario que explica el arreglo quedaba marcado como si fuera el bug
       (`company-switcher.tsx` tenia baseline 2: uno de codigo y uno de comentario);
     · y la VENTANA de descarte leia comentarios como evidencia — lo unico que
       salvaba a `scoreBarWidth` era la palabra "Ancho" de su JSDoc.

   La segunda es la grave, y es literalmente el titulo del #49: el descarte dependia
   de la prosa. */
describe("qa-rediseno-lint — los comentarios no son codigo", () => {
  it("un comentario que MENCIONA el patron no cuenta como incumplimiento", () => {
    escribir(
      "src/componentes/documentado.tsx",
      [
        "/* Ojo: aca NO se arma el porcentaje a mano con `${v}%`, se usa formatPct. */",
        "export const R = ({ v }: { v: number }) => <span>{v}</span>;",
        "",
      ].join(String.fromCharCode(10)),
    );
    expect(correr().code).toBe(0);

    /* EL GEMELO POSITIVO. La MISMA cadena, ahora en codigo, si se marca. Sin este
       assert un linter roto que no matchea nada pasaria el de arriba igual. */
    escribir(
      "src/componentes/culpable.tsx",
      "export const S = ({ v }: { v: number }) => <span>{`${v}%`}</span>;" +
        String.fromCharCode(10),
    );
    const r2 = correr();
    expect(r2.code).toBe(1);
    expect(r2.err).toContain("interpolado");
  });

  it("un comentario con una palabra CSS NO silencia un porcentaje real", () => {
    escribir(
      "src/componentes/jsdoc.ts",
      [
        "/** Ancho de barra: devuelve el width en porcentaje. */",
        "export function texto(v: number): string {",
        "  return `${v}% del total`;",
        "}",
        "",
      ].join(String.fromCharCode(10)),
    );
    const r = correr();
    expect(r.code).toBe(1);
    expect(r.err).toContain("interpolado");
  });

  it("un `//` dentro de un string no se traga el RESTO DE SU PROPIA linea", () => {
    /* Si el tokenizador tratara `https://` como comentario, todo lo que viene despues
       EN ESA MISMA LINEA se blanquearia — incluido el `${v}%` — y el guard se callaria
       sobre un archivo entero. El repo esta lleno de URLs en atributos.

       LA URL Y EL MATCH VAN EN LA MISMA LINEA A PROPOSITO. La primera version de este
       test los puso en lineas distintas y la mutacion "borrar la rama de strings"
       SOBREVIVIO: el dano no llegaba hasta el match. Un test que no puede fallar por la
       razon que dice no esta probando nada. */
    escribir(
      "src/componentes/url.tsx",
      [
        "export const R = ({ v }: { v: number }) => (",
        '  <a href="https://ejemplo.cl/guia">{`${v}%`} del total</a>',
        ");",
        "",
      ].join(String.fromCharCode(10)),
    );
    const r = correr();
    expect(r.code).toBe(1);
    expect(r.err).toContain("interpolado");
    /* Y en la linea 2, que es donde esta: si el `//` se hubiera tragado la linea, el
       hallazgo no existiria en absoluto. */
    expect(r.err).toContain("lineas 2");
  });

  it("el numero de linea sigue siendo el del ARCHIVO, no el del codigo sin comentarios", () => {
    /* Los comentarios se blanquean, no se borran. Si se borraran, el hallazgo de abajo
       se reportaria en la linea 1 y mandaria al lector al lugar equivocado. */
    escribir(
      "src/componentes/lineas.tsx",
      [
        "/* uno",
        "   dos",
        "   tres */",
        "export const R = ({ v }: { v: number }) => <span>{`${v}%`}</span>;",
        "",
      ].join(String.fromCharCode(10)),
    );
    const r = correr();
    expect(r.code).toBe(1);
    expect(r.err).toContain("lineas 4");
    expect(r.err).not.toContain("lineas 1");
  });
});

/* ── El descarte no gana sobre lo que el usuario lee (#49) ───────────────────────
   El falso negativo VIVO que motivo el issue: en `onboarding-shell.tsx` el
   `aria-label` con el porcentaje a mano lo silenciaba el `style={{ width: ... }}`
   cuatro lineas mas abajo. Las dos lineas son del mismo elemento y la ventana no las
   puede distinguir — pero una es CSS y la otra es lo que oye una persona ciega. */
describe("qa-rediseno-lint — el texto que el usuario lee gana al descarte CSS", () => {
  it("un aria-label con % a mano se marca aunque haya un width al lado", () => {
    escribir(
      "src/componentes/barra.tsx",
      [
        "export const R = ({ pct }: { pct: number }) => (",
        "  <div aria-label={`Progreso: ${pct}%`}>",
        "    <div style={{ width: `${pct}%` }} />",
        "  </div>",
        ");",
        "",
      ].join(String.fromCharCode(10)),
    );
    const r = correr();
    expect(r.code).toBe(1);
    expect(r.err).toContain("interpolado");
    /* UNO, no dos: el `style={{ width }}` de la linea 3 sigue siendo un ancho CSS y
       sigue descartandose. Si esto dijera 2, el override habria roto el descarte que
       justifica la ventana entera. */
    expect(r.err).toContain("1x  src/componentes/barra.tsx");
  });

  it("sin el aria-label, el mismo archivo no marca nada", () => {
    /* El contrapeso. Sin el, el override se satisface marcando siempre. */
    escribir(
      "src/componentes/barra2.tsx",
      [
        "export const R = ({ pct }: { pct: number }) => (",
        "  <div>",
        "    <div style={{ width: `${pct}%` }} />",
        "  </div>",
        ");",
        "",
      ].join(String.fromCharCode(10)),
    );
    expect(correr().code).toBe(0);
  });
});

/* ── El descarte por IDENTIFICADOR, que es el que sostiene la familia de anchos CSS ── */
describe("qa-rediseno-lint — el identificador camelCase descarta", () => {
  it("scoreBarWidth se descarta por su nombre, sin ayuda de ningun comentario", () => {
    /* La entrada `BarWidth` de la lista vieja NO podia disparar nunca: en
       `scoreBarWidth` la `W` viene despues de una `r`, o sea que no hay limite de
       palabra, y el `\b` del principio no matchea. El caso se salvaba por la prosa de
       su JSDoc. El fixture de abajo NO tiene comentario a proposito: con la lista
       vieja este test falla. */
    escribir(
      "src/componentes/ancho.ts",
      [
        "export function scoreBarWidth(score: number): string {",
        "  const clamped = Math.max(0, Math.min(100, score));",
        "  return `${clamped}%`;",
        "}",
        "",
      ].join(String.fromCharCode(10)),
    );
    expect(correr().code).toBe(0);
  });
});

/* ── Los cuatro vectores de desincronizacion del tokenizador ──────────────────────
   El pase §6 los midio contra `src/` y encontro DOS VIVOS en el repo, ninguno documentado ni
   testeado. Los cuatro fallan hacia el SILENCIO, que es el peor modo de falla que puede tener
   un guard: no se ve.

   Barrido posterior sobre los 845 archivos de `src/`: cero desincronizaciones (largo y saltos
   de linea identicos, ningun comentario sin blanquear). */
describe("qa-rediseno-lint — el tokenizador no se desincroniza", () => {
  it("un regex literal con comillas adentro no abre un string fantasma", () => {
    /* CASO VIVO: `libro-kpis-format.ts:58` tiene `return /[";\r\n]/.test(s)`. La `"` del
       regex abria un string que se comia el backtick de la linea siguiente, y el JSDoc de
       mas abajo quedaba SIN blanquear. */
    escribir(
      "src/componentes/regex.ts",
      [
        'const CSV = /[";]/;',
        "/** El width de la barra lo maneja el padre. */",
        "export function texto(v: number): string {",
        "  return `${v}% del total`;",
        "}",
        "",
      ].join(String.fromCharCode(10)),
    );
    const r = correr();
    expect(r.code).toBe(1);
    expect(r.err).toContain("interpolado");
  });

  it("un apostrofo dentro de un template anidado tampoco", () => {
    /* CASO VIVO: `tendencia-resultado.tsx:93`. El `'` abria un fantasma de 75 lineas. */
    escribir(
      "src/componentes/apostrofo.tsx",
      [
        "export function T({ anio, pct }: { anio: string; pct: number }) {",
        '  const t = `periodo${anio ? ` \'${anio}` : ""}`;',
        "  /* El height del contenedor va por CSS. */",
        "  return <b title={t}>{`${pct}% del total`}</b>;",
        "}",
        "",
      ].join(String.fromCharCode(10)),
    );
    const r = correr();
    expect(r.code).toBe(1);
    expect(r.err).toContain("interpolado");
  });

  it("un `/*` en texto JSX no borra el resto del archivo", () => {
    // Antes: cuando no encontraba el cierre del bloque, blanqueaba hasta EOF. Un guard que
    // borra codigo real es peor que uno que no existe.
    //
    // (Este comentario va con `//` a proposito: escribir la secuencia de cierre de bloque
    // adentro de un comentario de bloque lo cierra antes de tiempo. Me paso escribiendo
    // justamente este test.)
    escribir(
      "src/componentes/asterisco.tsx",
      [
        "export function A({ pct }: { pct: number }) {",
        "  return (",
        "    <div>",
        "      <span>Formato 24/7 y margen /* de seguridad</span>",
        "      <b>{`${pct}%`}</b>",
        "    </div>",
        "  );",
        "}",
        "",
      ].join(String.fromCharCode(10)),
    );
    const r = correr();
    expect(r.code).toBe(1);
    expect(r.err).toContain("interpolado");
  });

  it("LIMITACION CONOCIDA: un `//` en texto JSX si borra el resto de la linea", () => {
    /* Este test fija una limitacion, no un arreglo — y esta escrito asi a proposito para que
       la limitacion sea VISIBLE en vez de vivir en la cabeza de alguien.

       El tokenizador no distingue un `//` de comentario de uno que es texto que el usuario
       lee. Distinguirlo exigiria saber si estamos dentro de un nodo JSX, que es parsear JSX
       de verdad — y el #49 descarto el AST por costo para dos casos.

       POR QUE SE ACEPTA, medido: barrido de los 845 archivos de `src/` con el tokenizador
       instrumentado → CERO desincronizaciones (mismo largo, mismos saltos de linea, ningun
       comentario sin blanquear). Los dos vectores que SI estaban vivos —el regex con comilla
       y el template con apostrofo— si se cerraron.

       Si algun dia alguien lo arregla, este test se cae y hay que darlo vuelta. Es la senial
       de que la limitacion dejo de existir, no un estorbo. */
    escribir(
      "src/componentes/barras.tsx",
      [
        "export function B({ pct }: { pct: number }) {",
        "  return <span>ratio 3//4 y {`${pct}%`} del total</span>;",
        "}",
        "",
      ].join(String.fromCharCode(10)),
    );
    expect(correr().code).toBe(0);
  });
});

/* ── Los tres falsos negativos que la ventana de +-4 producia ─────────────────────
   El pase §6 instrumento los 28 descartes vivos del repo: **27 tienen la evidencia en la
   MISMA linea** del match. La ventana compraba UNO (`scoreBarWidth`) y a cambio silenciaba
   estas tres formas, que son las mas comunes de porcentaje visible. */
describe("qa-rediseno-lint — un ancho CSS vecino ya no silencia el texto del usuario", () => {
  it("texto JSX plano con un style width en la linea de abajo", () => {
    // El caso mas comun de todos: el porcentaje que el usuario LEE, sin ningun atributo.
    escribir(
      "src/componentes/jsxplano.tsx",
      [
        "export function P({ pct }: { pct: number }) {",
        "  return (",
        "    <div>",
        "      <span>Avance: {`${pct}%`}</span>",
        "      <div style={{ width: `${pct}%` }} />",
        "    </div>",
        "  );",
        "}",
        "",
      ].join(String.fromCharCode(10)),
    );
    const r = correr();
    expect(r.code).toBe(1);
    // UNO, no dos: el `style={{ width }}` sigue descartandose por su propia linea.
    expect(r.err).toContain("1x  src/componentes/jsxplano.tsx");
  });

  it("una prop que renderiza texto y no esta en la lista de atributos", () => {
    /* `label=` tiene 429 usos en `src/`, `description=` 104. El override mira una lista de
       atributos; la ventana los silenciaba a todos por un `maxWidth` cercano. */
    escribir(
      "src/componentes/chip.tsx",
      [
        "export function C({ pct }: { pct: number }) {",
        "  return (",
        "    <div style={{ maxWidth: 320 }}>",
        "      <Chip label={`Cobertura ${pct}%`} />",
        "    </div>",
        "  );",
        "}",
        "",
      ].join(String.fromCharCode(10)),
    );
    const r = correr();
    expect(r.code).toBe(1);
    expect(r.err).toContain("interpolado");
  });

  it("un aria-label partido en dos lineas por prettier", () => {
    /* El override mira la linea del match. Con el atributo en una linea y la interpolacion
       en la siguiente, no dispara — y con la ventana vieja el `style` de abajo lo silenciaba.
       Es un reflow de prettier de distancia. */
    escribir(
      "src/componentes/multilinea.tsx",
      [
        "export function M({ pct }: { pct: number }) {",
        "  return (",
        "    <div",
        "      aria-label={",
        "        `Progreso: ${pct}%`",
        "      }",
        "      style={{ width: `${pct}%` }}",
        "    />",
        "  );",
        "}",
        "",
      ].join(String.fromCharCode(10)),
    );
    const r = correr();
    expect(r.code).toBe(1);
    expect(r.err).toContain("interpolado");
  });
});

/* ── El override no se mete donde no lo llaman ──────────────────────────────────── */
describe("qa-rediseno-lint — el override es solo del descarte CSS", () => {
  it("un Intl.DateTimeFormat en-CA dentro de un title sigue sin reportarse", () => {
    /* `LOCALE_ISO` existe para no marcar `en-CA`/`sv-SE`: son el formato con el que se le
       habla a la API, no al usuario. Aplicar el override a TODOS los `saltarSi` metia un
       falso positivo en una regla que este trabajo no toca. */
    escribir(
      "src/componentes/fecha.tsx",
      [
        "export function F({ d }: { d: Date }) {",
        '  return <time title={new Intl.DateTimeFormat("en-CA").format(d)} />;',
        "}",
        "",
      ].join(String.fromCharCode(10)),
    );
    expect(correr().code).toBe(0);
  });
});

/* ── El gemelo que le faltaba al descarte por identificador ─────────────────────── */
describe("qa-rediseno-lint — el descarte por identificador mide el NOMBRE", () => {
  it("renombrar scoreBarWidth a scoreBarAncho lo vuelve a marcar", () => {
    /* El test hermano prueba que `scoreBarWidth` se descarta. Sin este, no prueba que sea
       POR SU NOMBRE — podria estar descartandose por cualquier otra razon. */
    escribir(
      "src/componentes/renombrada.ts",
      [
        "export function scoreBarAncho(score: number): string {",
        "  const clamped = Math.max(0, Math.min(100, score));",
        "  return `${clamped}%`;",
        "}",
        "",
      ].join(String.fromCharCode(10)),
    );
    const r = correr();
    expect(r.code).toBe(1);
    expect(r.err).toContain("interpolado");
  });
});

/* ── La frontera de palabra de `abreRegex` ─────────────────────────────────────────────
   `cola.endsWith(w)` no exigia frontera a la izquierda, asi que `in`/`of`/`case` matcheaban
   el final de CUALQUIER identificador: `min`, `margin`, `origin`, `join`, `admin`, `indexOf`,
   `lowercase`. Con eso `min / 2` se leia como apertura de regex.

   El dano es SILENCIOSO, que es el peor modo de falla que puede tener un guard: el modo regex
   se come la primera barra del `//` de la misma linea, el comentario queda como codigo, y como
   el descarte mira la linea del match, un `width` que estaba en ese comentario silencia un
   porcentaje real.

   LAS TRES COSAS TIENEN QUE ESTAR EN LA MISMA LINEA para que el defecto aparezca — la
   division, el porcentaje y el comentario— porque la rama de regex no cruza saltos de linea.
   La primera version de este test las puso en lineas distintas y por eso pasaba con y sin el
   arreglo: era hueco.

   ALCANCE, MEDIDO: sobre los 845 archivos de `src/` este arreglo no cambia nada. `node
   scripts/qa-rediseno-lint.mjs` da "14 incumplimientos, baseline 14" en HEAD, sin la frontera,
   y hasta borrando la lista de palabras entera. O sea que el defecto es LATENTE: se arregla
   por lo que va a pasar cuando alguien escriba esa linea, no por algo que hoy este roto. */
describe("qa-rediseno-lint — una division no se lee como regex", () => {
  it("un identificador terminado en `in` no abre modo regex", () => {
    /* Verificado a mano contra las dos versiones del script, con este mismo fixture:
       con `cola.endsWith(w)` pelado da exit 0 (silenciado); con la frontera, exit 1. */
    escribir(
      "src/componentes/division.ts",
      [
        "export function etiqueta(v: number, min: number): string {",
        "  const m = min / 2; const t = `${v}%`; // usa el width del contenedor",
        "  return t + String(m);",
        "}",
        "",
      ].join(String.fromCharCode(10)),
    );
    const r = correr();
    expect(r.code).toBe(1);
    expect(r.err).toContain("interpolado");
    expect(r.err).toContain("src/componentes/division.ts");
  });

  it("y el mismo archivo SIN la division no depende de la frontera", () => {
    /* EL CONTRAPESO que hace falta acá no es "que siga reportando" —eso lo daria cualquier
       cosa— sino aislar la CAUSA. Este fixture es identico salvo que no hay `/`: si el test
       de arriba fallara por otra razon (el comentario, el `String(m)`, el nombre `min`), este
       tambien fallaria, y sabriamos que la division no era el mecanismo. */
    escribir(
      "src/componentes/sin-division.ts",
      [
        "export function etiqueta(v: number, min: number): string {",
        "  const m = min + 2; const t = `${v}%`; // usa el width del contenedor",
        "  return t + String(m);",
        "}",
        "",
      ].join(String.fromCharCode(10)),
    );
    const r = correr();
    expect(r.code).toBe(1);
    expect(r.err).toContain("src/componentes/sin-division.ts");
  });
});
