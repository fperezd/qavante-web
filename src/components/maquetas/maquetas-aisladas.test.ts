import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/* Guardas de las maquetas. Las dos nacen del mismo accidente: la versión original de estas
   pantallas se montaba ENCIMA de las reales — `/banco` quedaba servido por la maqueta en
   cualquier ambiente, y `/cobrar` y `/pagar` la servían cuando `NODE_ENV` era de desarrollo —
   así que una pantalla que muestra plata quedaba mostrando cifras inventadas.
   Las listas se DERIVAN del filesystem, no se copian a mano: una maqueta nueva que se olvide
   del aviso, o un import que se escape de la carpeta, rompe el CI en vez de pasar inadvertido. */

const RAIZ = process.cwd();
const RUTAS_MAQUETAS = path.join(RAIZ, "src", "app", "(app)", "maquetas");
const COMPONENTES_MAQUETAS = path.join(RAIZ, "src", "components", "maquetas");

function paginasDeMaquetas(): string[] {
  return fs
    .readdirSync(RUTAS_MAQUETAS, { withFileTypes: true })
    .filter((entrada) => entrada.isDirectory())
    .map((entrada) => path.join(RUTAS_MAQUETAS, entrada.name, "page.tsx"))
    .filter((archivo) => fs.existsSync(archivo));
}

function archivosFuente(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) return archivosFuente(ruta);
    return /\.(ts|tsx)$/.test(entrada.name) ? [ruta] : [];
  });
}

describe("maquetas: el aviso de cifras de ejemplo", () => {
  it("hay al menos una maqueta (guarda contra una lista derivada que no matchea nada)", () => {
    expect(paginasDeMaquetas().length).toBeGreaterThanOrEqual(4);
  });

  for (const pagina of paginasDeMaquetas()) {
    const nombre = path.basename(path.dirname(pagina));
    it(`/maquetas/${nombre} renderiza el aviso de maqueta`, () => {
      const fuente = fs.readFileSync(pagina, "utf8");
      expect(fuente).toContain("MaquetaAviso");
    });
  }
});

describe("maquetas: no se mezclan con pantallas de datos reales", () => {
  it("ningún archivo fuera de las maquetas importa un componente de maquetas ni datos de ejemplo", () => {
    const permitidos = [RUTAS_MAQUETAS, COMPONENTES_MAQUETAS];
    const infractores = archivosFuente(path.join(RAIZ, "src"))
      .filter((archivo) => !permitidos.some((dir) => archivo.startsWith(dir)))
      .filter((archivo) => !archivo.endsWith(".test.ts") && !archivo.endsWith(".test.tsx"))
      .filter((archivo) => {
        const fuente = fs.readFileSync(archivo, "utf8");
        return (
          fuente.includes("@/components/maquetas/") ||
          fuente.includes("@/lib/demo/") ||
          /from "\.\.?\/.*maqueta/.test(fuente)
        );
      })
      .map((archivo) => path.relative(RAIZ, archivo));

    expect(infractores).toEqual([]);
  });

  it("ninguna pantalla de producto se sirve distinta porque el ambiente sea de desarrollo", () => {
    /* El mecanismo exacto con el que la maqueta entraba a Cobrar y a Pagar era un retorno
       temprano cuando el ambiente era de desarrollo. Un gate de ambiente no es un feature
       flag: no se puede apagar sin recompilar y no deja rastro en la configuración, así que
       nadie se entera de qué ambiente está sirviendo qué. `/playground` queda permitido —
       es una vitrina de componentes que SÓLO existe fuera de producción, no una pantalla
       que muestre plata. */
    const PERMITIDOS = ["src/app/playground/page.tsx"];
    const infractores = archivosFuente(path.join(RAIZ, "src", "app"))
      .filter((archivo) => !/\.(test|spec|stories)\.(ts|tsx)$/.test(archivo))
      .filter((archivo) =>
        /NODE_ENV\s*[!=]==?\s*"(development|production)"/.test(fs.readFileSync(archivo, "utf8")),
      )
      .map((archivo) => path.relative(RAIZ, archivo).split(path.sep).join("/"))
      .filter((archivo) => !PERMITIDOS.includes(archivo));

    expect(infractores).toEqual([]);
  });
});
