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

/* Y EL HUECO QUE #402 DEJO ABIERTO: EL BUMP DE UNA DEPENDENCIA DIRECTA.
   #402 eximio al PR que mueve SOLO `package-lock.json`, o sea al bump transitivo. Pero
   Dependabot, cuando sube una dependencia DIRECTA, toca tambien `package.json` — y ahi el PR
   vuelve a ser material y vuelve a pedir las tres secciones que Dependabot no escribe.

   Medido el 2026-10-05: cinco PR de Dependabot a la vez con `change-evidence` en rojo (#410,
   #411, #412, #413 y el ya cerrado #409), los cinco tocando exactamente
   `package.json` + `package-lock.json`. Y no era un bloqueo que una persona pudiera destrabar
   escribiendo las secciones: `@dependabot rebase` SE NIEGA en un PR cuyo cuerpo edito alguien
   que no es Dependabot, asi que escribirlas costaba ademas el rebase.

   La exencion exige LAS DOS cosas, y la primera es la que la hace segura:

     1. que el autor sea Dependabot — una persona que toca `package.json` SIGUE necesitando las
        secciones, porque ahi si hay una dependencia que alguien eligio agregar;
     2. que el PR no toque nada mas que los dos manifiestos.

   El autor sale del evento de GitHub (`pull_request.user.login`), no del cuerpo ni de una
   etiqueta: no es un campo que un contribuyente pueda escribir.

   Lo que cubre el riesgo en lugar de las secciones es lo mismo que en #402, y ahora mide mas:
   `dependency-audit` (`npm audit --audit-level=critical`) mas `build`, `e2e`, `storybook` y
   `chromatic` corriendo sobre el arbol ya resuelto. */
const MANIFIESTO_DE_DEPENDENCIAS = /^package(?:-lock)?\.json$/i;
const AUTORES_DE_DEPENDENCIAS = Object.freeze(["dependabot[bot]", "dependabot-preview[bot]"]);

export function evaluateChangeEvidence({
  labels = [],
  files = [],
  body = "",
  draft = false,
  author = "",
}) {
  if (draft) return { risk: "draft", material: false, protectedPaths: [] };

  const risks = labels.filter((label) => /^risk:R[012]$/.test(label));
  if (risks.length > 1) throw new Error("El PR tiene más de un label de riesgo.");
  const protectedPaths = files.filter((file) => HIGH_RISK.some((pattern) => pattern.test(file)));
  const risk = risks[0] ?? "risk:R0";

  if (protectedPaths.length && risk !== "risk:R2") {
    throw new Error(`Paths protegidos requieren risk:R2: ${protectedPaths.slice(0, 8).join(", ")}`);
  }

  const soloDependencias =
    AUTORES_DE_DEPENDENCIAS.includes(author) &&
    files.length > 0 &&
    files.every((file) => MANIFIESTO_DE_DEPENDENCIAS.test(file));
  const material =
    !soloDependencias &&
    files.some((file) => !DOC_ONLY.test(file) && !LOCKFILE_ONLY.test(file));
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
