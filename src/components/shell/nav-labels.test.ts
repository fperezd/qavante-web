import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { COMMANDS } from "./command-palette-commands";
import { OBLIGACIONES_FINANCIERAS } from "@/lib/nav-labels";

/* La misma pantalla no puede llamarse de dos maneras según por dónde llegues.

   `/pagar/obligaciones` se llamaba "Obligaciones con entidades financieras" en el
   sidebar y "Préstamos y obligaciones" en el command palette (⌘K) y en el enlace
   desde Pagar. Nada lo impedía: cada lugar escribía el nombre a mano. */

describe("nombres de navegación", () => {
  it("el command palette llama a /pagar/obligaciones como el sidebar", () => {
    const comando = COMMANDS.find((c) => c.href === "/pagar/obligaciones");
    expect(comando, "desapareció el comando de obligaciones del ⌘K").toBeDefined();
    expect(comando!.label).toBe(OBLIGACIONES_FINANCIERAS);
  });

  it("el sidebar toma el nombre de la constante y no de un string suelto", () => {
    /* Se mira el FUENTE a propósito: el sidebar es un componente con JSX y montarlo
       acá sólo para leer una etiqueta ataría este test al árbol de React. Lo que
       importa es que el nombre no vuelva a escribirse a mano. */
    const fuente = readFileSync(new URL("./sidebar.tsx", import.meta.url), "utf-8");
    expect(fuente).toContain('{ href: "/pagar/obligaciones", label: OBLIGACIONES_FINANCIERAS }');
  });

  it("ningún nombre de pantalla quedó duplicado como texto suelto", () => {
    for (const archivo of [
      "./sidebar.tsx",
      "./command-palette-commands.ts",
      "../pagar/v05/pagar-v05-view.tsx",
    ]) {
      const fuente = readFileSync(new URL(archivo, import.meta.url), "utf-8");
      expect(fuente, `${archivo} volvió a escribir el nombre a mano`).not.toContain(
        `"${OBLIGACIONES_FINANCIERAS}"`,
      );
      expect(fuente, `${archivo} quedó con el nombre viejo`).not.toContain(
        "Préstamos y obligaciones",
      );
    }
  });
});
