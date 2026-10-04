import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { RESULTADO_CORRIDO, RESULTADO_HORIZONTE } from "./gestion-titulos";

/* En /gestion había DOS bloques montados uno encima del otro y los dos se titulaban
   "Resultado operacional": uno mira hacia atrás (lo corrido, por período) y el otro hacia
   adelante (`as_of+1` a `as_of+90`). Nada lo impedía: cada componente escribía el título a mano.

   CONTROL NEGATIVO de este archivo: si alguien vuelve a dejar los dos bloques con el mismo
   nombre —p.ej. `RESULTADO_HORIZONTE = "Resultado operacional"`— el primer test falla. Está
   verificado corriéndolo con esa mutación aplicada (ver el PR). */

/** Quita comentarios: los rótulos se CITAN en prosa para explicar el cambio, y eso no es
 *  escribirlos a mano. Lo que importa es que no aparezcan en el código que renderiza. */
function soloCodigo(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const FUENTES = {
  horizonte: "../components/gestion/operational-result-v2-panel.tsx",
  corrido: "../components/gestion/operational-result-corrido-panel.tsx",
} as const;

describe("rótulos de los bloques de /gestion", () => {
  it("los dos bloques NO pueden llamarse igual", () => {
    expect(
      RESULTADO_HORIZONTE,
      "el bloque del horizonte volvió a llamarse como el de lo corrido: el lector no puede saber de qué período habla cada cifra",
    ).not.toBe(RESULTADO_CORRIDO);
  });

  it("el bloque de lo corrido conserva el nombre que el dueño espera", () => {
    expect(RESULTADO_CORRIDO).toBe("Resultado operacional");
  });

  it("el nombre del horizonte no se lee como un resultado ya ocurrido", () => {
    expect(RESULTADO_HORIZONTE.toLowerCase()).not.toContain("resultado");
  });

  it("ningún componente vuelve a escribir los rótulos a mano", () => {
    /* Se mira el FUENTE a propósito (igual que `shell/nav-labels.test.ts`): montar los
       componentes acá sólo para leer una etiqueta ataría este test al árbol de React. Lo que
       importa es que el nombre no vuelva a escribirse a mano en ningún bloque. */
    for (const archivo of Object.values(FUENTES)) {
      const fuente = soloCodigo(readFileSync(new URL(archivo, import.meta.url), "utf-8"));
      expect(fuente, `${archivo} volvió a escribir "${RESULTADO_CORRIDO}" a mano`).not.toContain(
        `"${RESULTADO_CORRIDO}"`,
      );
      expect(fuente, `${archivo} volvió a escribir "${RESULTADO_HORIZONTE}" a mano`).not.toContain(
        `"${RESULTADO_HORIZONTE}"`,
      );
      expect(fuente, `${archivo} no toma el rótulo de la fuente única`).toContain(
        'from "@/lib/gestion-titulos"',
      );
    }
  });

  it("los dos bloques reusan la misma presentación en vez de copiarla", () => {
    /* Fernando pidió el MISMO diseño en los dos. Si uno de los dos deja de importar
       `./resultado-bloque`, es que volvió a tener su propio marcado. */
    for (const archivo of Object.values(FUENTES)) {
      const fuente = readFileSync(new URL(archivo, import.meta.url), "utf-8");
      expect(fuente, `${archivo} dejó de reusar la presentación compartida`).toContain(
        'from "./resultado-bloque"',
      );
    }
  });
});
