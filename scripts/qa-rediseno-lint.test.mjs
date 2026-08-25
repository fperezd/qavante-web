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

  /* Los dos descartes que el pase §6 midió como el 26% de ruido del baseline. */
  it("un ancho CSS no es una cifra: no se marca", () => {
    escribir(
      "src/componentes/barra.tsx",
      "export const Barra = ({ pct }: { pct: number }) => (\n  <div style={{ width: `${pct}%` }} />\n);\n",
    );
    expect(correr().code).toBe(0);
  });

  /* EL CASO REAL, y el que obliga a la VENTANA de +-4 lineas. En `scoreBarWidth` la
     palabra "width" no esta en la linea del match: esta en el nombre de la funcion y en
     su comentario. Un descarte que mire solo la linea deja viva toda esa familia — que
     es el 26% de ruido que midio el pase §6. Este test muere si la ventana se angosta. */
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
   con la suite en verde — y aportan 8 de los 15 incumplimientos del baseline vivo, o sea
   que borrarlos no era hipotetico: vaciaba medio guard. Cada fila de esta tabla muere si
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

/* El descarte de anchos CSS estaba cubierto SOLO del lado del falso positivo: ensanchar
   la ventana o la lista de palabras sobrevivia. Este fija el otro lado — un porcentaje de
   VERDAD sigue marcandose aunque el archivo mencione "width" lejos.

   La primera version de este test FALLO, y ensenio la limitacion que el pase §6 habia
   anotado: el fixture usaba `const ancho = 10` y `export { ancho }` a una linea del match,
   y "ancho" esta en la lista de descarte, asi que el porcentaje real quedaba silenciado.
   O sea que la ventana SI se puede acallar con una palabra de prosa o un identificador
   cercano. Es una limitacion conocida y aceptada: el precio de no tener falsos positivos
   en la familia de anchos CSS, que era el 26% del baseline. Queda dicho aca en vez de
   descubrirse de nuevo. */
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
