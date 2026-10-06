/* EL PRODUCTO HABLA ESPAÑOL DE CHILE, Y NADIE LO VERIFICABA EN ESTE REPO.
   El gate equivalente de la API entró el 2026-10-06 (api#1102) y encontró 92 ocurrencias, 51 en
   cadenas que ve un usuario. Cinco de sus doce excepciones eran **citas de copy de este repo**,
   así que acá tenía que haber lo mismo. Medido: 7 cadenas en voseo, todas en login, callback de
   Auth0 y mi cuenta — las pantallas de quien recién llega. Corregidas.

   POR QUÉ ES UNA LISTA DE FORMAS EXACTAS Y NO UNA REGLA MORFOLÓGICA.
   La regla obvia —«palabra acentuada en -á/-é/-í»— es inusable: en la API dio 3.714 marcas para 92
   argentinismos reales. Marcaba `está`, `así`, `después`, los futuros (`será`, `podrá`), los
   pretéritos de primera persona (`encontré`, `vendí`) y hasta «Gastos generales», que es
   `generar`+`les` y vive en una cadena de usuario. Un gate que marca «Gastos generales» se apaga
   en una semana, y entonces no protege nada.

   Y UN FALSO POSITIVO QUE COMETÍ ARMANDO ESTE BARRIDO: el patrón `Corr[ée]` marca `Corre el
   clasificador`, que es tercera persona correcta. **La tilde es lo único que separa el imperativo
   voseante de la forma castellana**, así que cada entrada lleva su tilde y ninguna acepta la
   variante sin acento. Hay un gemelo que lo fija. */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.resolve(__dirname, "../../..");
const FUENTE = path.join(RAIZ, "src");

/* Formas de voseo, con tilde obligatoria donde la lleva. */
const FORMAS = [
  "corré", "andá", "mirá", "fijate", "apretá", "elegí", "revisá", "volvé", "reintentá",
  "refrescá", "cargá", "sacá", "poné", "agregá", "revertí", "sumá", "guardá", "coordiná",
  "agendá", "tenés", "podés", "querés", "necesitás", "seteás", "cobrás", "pagás",
  "financiás", "clasificás", "aceptás", "mandás", "vos",
] as const;

/* QUÉ QUEDA FUERA DEL BARRIDO, Y POR QUÉ CADA UNO.

   - Este archivo: tiene que contener las formas para poder probarlas. Sin esta exclusión el gate
     se cazaría a sí mismo, que es la versión boba de medirse en el espejo.
   - `src/lib/api/types.ts`: lo GENERA `npm run generate:api` desde el contrato. Su copy no se
     escribe acá —viene del `description` de los endpoints— y lo vigila el gate del repo de la API.
     Editarlo a mano se perdería en la próxima regeneración.
   - Los `*.test.ts(x)`: no llegan a ningún usuario, y además varios contienen estas formas **a
     propósito**: `cobrar-v2-map.test.ts` ya tenía su propio mini-gate asertando que la copia NO
     las usa, y `dte-preview-error.test.ts` fija como fixture un mensaje que produce la API.
     Las `.stories.tsx` SÍ entran: alimentan Chromatic y son material de revisión. */
const FUERA_DEL_BARRIDO = [
  "src/lib/copy/no-voseo.test.ts",
  "src/lib/api/types.ts",
];

/* Citas verbatim de código que ya no existe. Corregir la cita falsearía la evidencia de qué decía
   el código, que es justamente lo que el comentario explica. Ninguna es una cadena que vea un
   usuario; un test de abajo lo exige. */
const EXCEPCIONES: ReadonlyArray<{ archivo: string; linea: number; motivo: string }> = [
  {
    archivo: "src/app/(app)/administracion/usuarios/page.tsx",
    linea: 42,
    motivo: 'cita del literal muerto "salvo que vos seas owner" que el comentario viene a explicar',
  },
  {
    archivo: "src/components/administracion/users-table.tsx",
    linea: 61,
    motivo: "misma cita, en el archivo donde vivía",
  },
];

function archivos(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name === "node_modules" || entrada.name === ".next") continue;
      salida.push(...archivos(completo));
    } else if (/\.(ts|tsx)$/.test(entrada.name) && !/\.test\.tsx?$/.test(entrada.name)) {
      salida.push(completo);
    }
  }
  return salida;
}

function hallazgos(texto: string): { linea: number; forma: string }[] {
  const encontrados: { linea: number; forma: string }[] = [];
  texto.split("\n").forEach((linea, i) => {
    for (const forma of FORMAS) {
      if (new RegExp(`(^|[^\\p{L}])${forma}($|[^\\p{L}])`, "iu").test(linea)) {
        encontrados.push({ linea: i + 1, forma });
        break;
      }
    }
  });
  return encontrados;
}

const relativo = (p: string) => path.relative(RAIZ, p).replace(/\\/g, "/");
const exceptuado = (archivo: string, linea: number) =>
  EXCEPCIONES.some((e) => e.archivo === archivo && e.linea === linea);

describe("el producto habla español de Chile", () => {
  const vigilados = archivos(FUENTE).filter((p) => !FUERA_DEL_BARRIDO.includes(relativo(p)));

  it("ningún archivo de src/ usa formas de voseo", () => {
    const sucios: string[] = [];
    for (const archivo of vigilados) {
      const rel = relativo(archivo);
      for (const h of hallazgos(fs.readFileSync(archivo, "utf8"))) {
        if (!exceptuado(rel, h.linea)) sucios.push(`${rel}:${h.linea} «${h.forma}»`);
      }
    }
    expect(sucios, "Formas de voseo en el código. El producto habla español de Chile.").toEqual([]);
  });

  it("el gemelo: el barrido SÍ caza una forma plantada, y la nombra", () => {
    /* Sin esto, un patrón roto devolvería la lista vacía y el gate pasaría siempre: la aserción
       hueca que esta clase de guarda existe para evitar. */
    const h = hallazgos('setError("No pudimos guardar. Volvé a intentar.");');
    expect(h).toHaveLength(1);
    expect(h[0]?.forma).toBe("volvé");
  });

  it("el otro gemelo: NO marca la tercera persona sin tilde", () => {
    expect(hallazgos("* @description Corre el clasificador sobre el residuo")).toEqual([]);
    expect(hallazgos("if (corre) return;")).toEqual([]);
    expect(hallazgos("const vosotros = 1;")).toEqual([]);
  });

  it("ninguna excepción está muerta: cada una corresponde a un hallazgo real", () => {
    /* Una excepción muerta es permiso acumulado sin dueño: queda cubriendo una línea que cambió de
       contenido, y nadie se entera. */
    for (const e of EXCEPCIONES) {
      const texto = fs.readFileSync(path.join(RAIZ, e.archivo), "utf8");
      const encontrado = hallazgos(texto).some((h) => h.linea === e.linea);
      expect(encontrado, `la excepción de ${e.archivo}:${e.linea} ya no cubre nada: ${e.motivo}`)
        .toBe(true);
    }
  });

  it("y mira archivos de verdad: un barrido que no vigila nada no prueba nada", () => {
    expect(vigilados.length).toBeGreaterThan(200);
  });
});
