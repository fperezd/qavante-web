const MATERIAL_SECTIONS = Object.freeze([
  /^(?:##|#)\s+(?:risk|riesgo)\s*$/im,
  /^(?:##|#)\s+(?:evidence|evidencia)\s*$/im,
  /^(?:##|#)\s+rollback\s*$/im,
]);

const HIGH_RISK = Object.freeze([
  /^src\/.*(?:auth|session|credential|money|financial|cash|caja|cobrar|pagar|decision|forecast|p&l)/i,
  /^src\/middleware\.ts$/i,
  /^docs\/contracts\//i,
  /^\.github\/(?:workflows\/|change-evidence|release)/i,
  /^wrangler\.toml$/i,
]);

const DOC_ONLY = /^(?:docs\/|[^/]+\.md$)/i;

/** En el MISMO orden que `MATERIAL_SECTIONS`: el nombre se busca por indice, no por posicion
 *  en la lista de las que faltan. */
const NOMBRES_DE_SECCION = Object.freeze(["Risk/Riesgo", "Evidence/Evidencia", "Rollback"]);

/* UN BUMP DE LOCKFILE NO TIENE UNA FRASE QUE ESCRIBIR.
   Este gate existe para que alguien PIENSE antes de tocar algo riesgoso. Un PR que sólo mueve
   `package-lock.json` no es ese caso: no hay decisión que justificar, así que exigirle las tres
   secciones es fricción sin beneficio — y peor, entrena a tratar el gate como trámite, cuando es
   el que protege las rutas de dinero.

   Y la fricción no era de una vez: Dependabot no escribe las secciones, así que cada PR de
   dependencias nacía bloqueado hasta que una persona le editaba el cuerpo a mano, y Dependabot
   REESCRIBE el cuerpo en cada rebase, así que se perdían en cada `update-branch` y había que
   ponerlas de nuevo.

   Lo que cubre el riesgo de un bump en lugar de las secciones: `dependency-audit`
   (`npm audit --audit-level=critical`) más `build`, `e2e`, `storybook` y `chromatic` corriendo
   sobre el árbol ya resuelto. Eso mide el bump; una plantilla copiada no mide nada.

   EL ALCANCE ES EL MÍNIMO A PROPÓSITO: sólo `package-lock.json`. Si el PR toca además
   `package.json` sigue siendo material y sigue pidiendo las secciones, porque ahí hay una
   dependencia DIRECTA que alguien eligió agregar o subir, y eso sí es una decisión. Un bump
   transitivo es puro lockfile; una dependencia nueva no.

   `protectedPaths` NO se toca: si algún día un lockfile cayera bajo una ruta protegida, que siga
   exigiendo `risk:R2`. */
const LOCKFILE_ONLY = /^package-lock\.json$/i;

export function evaluateChangeEvidence({ labels = [], files = [], body = "", draft = false }) {
  if (draft) return { risk: "draft", material: false, protectedPaths: [] };

  const risks = labels.filter((label) => /^risk:R[012]$/.test(label));
  if (risks.length > 1) throw new Error("El PR tiene más de un label de riesgo.");
  const protectedPaths = files.filter((file) => HIGH_RISK.some((pattern) => pattern.test(file)));
  const risk = risks[0] ?? "risk:R0";

  if (protectedPaths.length && risk !== "risk:R2") {
    throw new Error(`Paths protegidos requieren risk:R2: ${protectedPaths.slice(0, 8).join(", ")}`);
  }

  const material = files.some((file) => !DOC_ONLY.test(file) && !LOCKFILE_ONLY.test(file));
  if (material) {
    /* EL NOMBRE SALE DEL INDICE EN `MATERIAL_SECTIONS`, NO DEL INDICE DESPUES DE FILTRAR.
       Antes el `.map` venia DESPUES del `.filter`, asi que el indice era la posicion en el
       arreglo ya filtrado: a un PR que solo le faltaba `## Evidencia` el gate le decia que le
       faltaba `Risk/Riesgo`, y a uno que le faltaban Evidencia y Rollback le nombraba
       Riesgo y Evidencia. Siempre los primeros N, nunca los que faltaban.

       No es cosmetico: el gate existe para que alguien PIENSE antes de tocar una ruta de
       dinero, y mandarlo a escribir una seccion que ya tiene lo manda a buscar en el lugar
       equivocado. Pasó de verdad con el PR #406. */
    const missing = NOMBRES_DE_SECCION.filter((_, index) => !MATERIAL_SECTIONS[index].test(body));
    if (missing.length) throw new Error(`Faltan secciones mecánicas: ${missing.join(", ")}.`);
  }

  return { risk, material, protectedPaths };
}
