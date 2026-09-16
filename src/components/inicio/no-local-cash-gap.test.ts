import { describe, expect, it } from "vitest";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LOCAL_CASH_GAP_PATTERNS,
  LOCAL_CASH_GAP_SAMPLES,
  productionSources,
} from "@/test/no-local-cash-gap";

/* Guard `no-local-cash-gap` sobre el Inicio entero (v01, v2, resumen y los publicadores sueltos).
 *
 * Existe por el #296: `cash-gap-14d.ts` armaba la brecha como `Math.max(0, critical - projected)`
 * y publicaba el saldo final con el signo cambiado en el caso mixto, aunque el backend publica
 * `cash_gap_amount_14d`. Era latente (la ruta viva es `hoyV01`) y es el rollback documentado.
 * El guard fija que ninguna de las formas vuelva, en ningún publicador del Inicio. */

const HERE = dirname(fileURLToPath(import.meta.url));
const productionFiles = productionSources(HERE, { recursive: true });

describe("Inicio no deriva la brecha de caja: la publica el backend (D01/D03)", () => {
  it("prohíbe restas entre obligaciones y caja en todo el código productivo del Inicio", () => {
    expect(productionFiles.length).toBeGreaterThan(10);
    for (const file of productionFiles) {
      for (const pattern of LOCAL_CASH_GAP_PATTERNS) {
        expect(file.source, `${file.name} contiene ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("GEMELO POSITIVO · los patrones atrapan las formas que prohíben", () => {
    for (const sample of LOCAL_CASH_GAP_SAMPLES) {
      expect(
        LOCAL_CASH_GAP_PATTERNS.some((pattern) => pattern.test(sample)),
        `ningún patrón casa con: ${sample}`,
      ).toBe(true);
    }
  });

  it("los publicadores de la brecha leen cash_gap_amount_14d del contrato", () => {
    const publicadores = ["cash-gap-14d.ts", "resumen/inicio-resumen-model.ts"];
    for (const rel of publicadores) {
      const file = productionFiles.find((f) => f.name.endsWith(rel));
      expect(file, rel).toBeDefined();
      expect(file!.source).toContain("cash_gap_amount_14d");
    }
  });
});
