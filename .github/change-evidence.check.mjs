import assert from "node:assert/strict";
import { evaluateChangeEvidence } from "./change-evidence.mjs";

/* LA EXENCION DE DEPENDABOT SOBRE LOS DOS MANIFIESTOS.
   #402 eximio al PR que mueve SOLO `package-lock.json`. El bump de una dependencia DIRECTA
   toca tambien `package.json`, asi que volvia a ser material: cinco PR de Dependabot a la vez
   con `change-evidence` en rojo el 2026-10-05, y ninguno destrabable, porque
   `@dependabot rebase` se niega en un PR cuyo cuerpo edito una persona.

   Los cuatro casos de abajo son las cuatro esquinas, y las dos ultimas son las que importan:
   sin ellas, una exencion que mirara solo los archivos dejaria pasar a cualquiera que toque
   `package.json`, y a Dependabot tocando codigo. */
{
  const SIN_SECCIONES = "bump de dependencias";
  const DEPENDABOT = "dependabot[bot]";
  const PERSONA = "fperezd";
  const MANIFIESTOS = ["package.json", "package-lock.json"];

  // 1 · Dependabot sobre los dos manifiestos: EXENTO.
  assert.equal(
    evaluateChangeEvidence({ files: MANIFIESTOS, body: SIN_SECCIONES, author: DEPENDABOT })
      .material,
    false,
    "Dependabot tocando solo los manifiestos tiene que quedar exento",
  );

  // 2 · Dependabot sobre el lockfile solo: sigue exento (es #402, no se rompe).
  assert.equal(
    evaluateChangeEvidence({
      files: ["package-lock.json"],
      body: SIN_SECCIONES,
      author: DEPENDABOT,
    }).material,
    false,
    "el caso de #402 tiene que seguir exento",
  );

  // 3 · UNA PERSONA sobre los mismos archivos: NO exento.
  //     Ahi si hay una dependencia que alguien eligio agregar o subir, y eso es una decision.
  assert.throws(
    () =>
      evaluateChangeEvidence({ files: MANIFIESTOS, body: SIN_SECCIONES, author: PERSONA }),
    /Faltan secciones/,
    "una persona tocando package.json SIGUE necesitando las tres secciones",
  );

  // 4 · Dependabot tocando codigo ademas de los manifiestos: NO exento.
  assert.throws(
    () =>
      evaluateChangeEvidence({
        files: [...MANIFIESTOS, "src/app/page.tsx"],
        body: SIN_SECCIONES,
        author: DEPENDABOT,
      }),
    /Faltan secciones/,
    "la exencion no puede cubrir un PR que ademas toca codigo",
  );

  // 5 · Sin autor (el caso de un llamador viejo que no lo pasa): NO exento.
  assert.throws(
    () => evaluateChangeEvidence({ files: MANIFIESTOS, body: SIN_SECCIONES }),
    /Faltan secciones/,
    "sin autor la exencion no aplica: falla cerrado",
  );
}

/* EL GATE TIENE QUE NOMBRAR LA SECCION QUE FALTA, NO LAS PRIMERAS N.
   El `.map` venia despues del `.filter`, asi que el indice era la posicion en el arreglo ya
   filtrado y el gate nombraba siempre las primeras: a un PR al que solo le faltaba
   `## Evidencia` le decia que le faltaba `Risk/Riesgo`. Paso de verdad con el PR #406.

   Los asserts de mas abajo sobre este mismo error solo piden /Faltan secciones/, que es
   exactamente lo que dejaba pasar el defecto: el mensaje DECIA "Faltan secciones" y estaba
   mal. Estos tres nombran la seccion Y verifican que NO nombre las otras dos: sin esa segunda
   mitad, un gate que listara las tres siempre pasaria igual. */
{
  const SOLO_RIESGO = "## Riesgo\nr";
  const SOLO_EVIDENCIA = "## Evidencia\ne";
  const SOLO_ROLLBACK = "## Rollback\nx";

  const casos = [
    ["Risk/Riesgo", [SOLO_EVIDENCIA, SOLO_ROLLBACK], /Risk\/Riesgo/, [/Evidence/, /Rollback/]],
    [
      "Evidence/Evidencia",
      [SOLO_RIESGO, SOLO_ROLLBACK],
      /Evidence\/Evidencia/,
      [/Riesgo/, /Rollback/],
    ],
    ["Rollback", [SOLO_RIESGO, SOLO_EVIDENCIA], /Rollback/, [/Riesgo/, /Evidence/]],
  ];

  for (const [falta, presentes, esperado, noEsperados] of casos) {
    let mensaje = null;
    try {
      evaluateChangeEvidence({ files: ["src/example.ts"], body: presentes.join("\n\n") });
    } catch (error) {
      mensaje = error.message;
    }
    assert.ok(mensaje, `tenia que fallar cuando falta ${falta}`);
    assert.match(mensaje, esperado, `tenia que nombrar ${falta}, dijo: ${mensaje}`);
    for (const otra of noEsperados) {
      assert.doesNotMatch(mensaje, otra, `nombro una seccion que SI estaba: ${mensaje}`);
    }
  }
}

const body = "## Risk\nR0\n## Evidence\nTests\n## Rollback\nRevert";
assert.equal(evaluateChangeEvidence({ files: ["docs/README.md"], body }).risk, "risk:R0");
assert.equal(evaluateChangeEvidence({ files: ["src/example.ts"], body }).material, true);
assert.throws(
  () =>
    evaluateChangeEvidence({
      labels: ["risk:R0"],
      files: ["docs/contracts/openapi.snapshot.json"],
      body,
    }),
  /risk:R2/,
);
assert.throws(
  () =>
    evaluateChangeEvidence({
      labels: ["risk:R0"],
      files: ["src/components/caja/caja-resumen.tsx"],
      body,
    }),
  /risk:R2/,
);
assert.throws(
  () => evaluateChangeEvidence({ files: ["src/example.ts"], body: "sin secciones" }),
  /Faltan secciones/,
);
assert.doesNotThrow(() =>
  evaluateChangeEvidence({
    labels: ["risk:R2"],
    files: ["docs/contracts/openapi.snapshot.json"],
    body,
  }),
);

/* ── Un bump de lockfile no es material ──────────────────────────────────────────────────────
   Dependabot no escribe las secciones y REESCRIBE el cuerpo en cada rebase, así que cada PR de
   dependencias nacía bloqueado y volvía a bloquearse en cada `update-branch`. El cuerpo de abajo
   es el que Dependabot manda de verdad: sin ninguna de las tres secciones. */
const cuerpoDependabot = "Bumps [undici](https://github.com/nodejs/undici) from 7.16.0 to 7.17.0.";

// 1 · sólo `package-lock.json` → no material, pasa sin secciones.
assert.equal(
  evaluateChangeEvidence({ files: ["package-lock.json"], body: cuerpoDependabot }).material,
  false,
);
assert.doesNotThrow(() =>
  evaluateChangeEvidence({ files: ["package-lock.json"], body: cuerpoDependabot }),
);

/* 2 · `package-lock.json` + `package.json` → SIGUE siendo material y sigue pidiendo secciones.
   Ahí hay una dependencia DIRECTA que alguien eligió agregar o subir: eso es una decisión y
   merece una frase. Es el límite del alcance, y es lo que impide que la exención se ensanche. */
assert.equal(
  evaluateChangeEvidence({
    files: ["package-lock.json", "package.json"],
    body,
  }).material,
  true,
);
assert.throws(
  () =>
    evaluateChangeEvidence({
      files: ["package-lock.json", "package.json"],
      body: cuerpoDependabot,
    }),
  /Faltan secciones/,
);

// 3 · `package-lock.json` + un archivo de `src/` → material: que no se cuele código bajo un bump.
assert.throws(
  () =>
    evaluateChangeEvidence({
      files: ["package-lock.json", "src/example.ts"],
      body: cuerpoDependabot,
    }),
  /Faltan secciones/,
);

/* La exención es del lockfile de la raíz y de nada más: un `package-lock.json` anidado (el de un
   paquete cualquiera del árbol) no se exime, porque el regex está anclado a la raíz. */
assert.equal(
  evaluateChangeEvidence({ files: ["tools/algo/package-lock.json"], body }).material,
  true,
);

/* Y `protectedPaths` no se tocó: si un lockfile cayera bajo una ruta protegida, sigue exigiendo
   `risk:R2` aunque no sea material. No material significa "no hace falta la frase", nunca
   "no hace falta el label". */
assert.throws(
  () =>
    evaluateChangeEvidence({
      labels: ["risk:R0"],
      files: ["package-lock.json", "wrangler.toml"],
      body: cuerpoDependabot,
    }),
  /risk:R2/,
);

console.log("change-evidence: OK");
