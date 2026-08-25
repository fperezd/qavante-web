import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/* C0-13 middleware: rutas protegidas redirigen a /login cuando no hay
   cookie de sesión. Este spec previene regresión del bug donde middleware.ts
   estaba en raíz (Next.js lo ignoraba por la estructura src/).

   La lista de rutas protegidas se DERIVA del filesystem, no se copia a mano. La versión
   a mano fallaba justamente en lo que tenía que atrapar: enumeraba 7 rutas mientras el
   route group `(app)` tenía 12, así que `/alertas`, `/conexiones`, `/banco`,
   `/presupuesto` y `/remuneraciones` se servían sin sesión y ningún test lo veía. Una
   lista copiada sólo prueba lo que alguien se acordó de copiar; el directorio, en cambio,
   crece solo con cada pantalla nueva. Si agregas una carpeta a `src/app/(app)/` y no la
   sumas al `matcher` de `src/middleware.ts`, este spec se cae. */

const APP_GROUP_DIR = path.join(process.cwd(), "src", "app", "(app)");

/** Toda carpeta de primer nivel de `(app)/` es una pantalla autenticada.
 *
 *  Los route groups —`(x)`— NO aportan segmento a la URL: sus hijos viven en el nivel del
 *  padre, así que hay que ENTRAR en ellos. Saltarlos (que es lo que hacía la primera versión
 *  de este guard) deja un agujero exacto: `(app)/(grupo)/oculta/page.tsx` sirve `/oculta`,
 *  el matcher no la lista y el spec pasa igual. Y `(…)` es justamente donde Next.js invita a
 *  poner los grupos de layout, o sea donde va a aparecer la próxima pantalla. Un guard con un
 *  agujero conocido es el mismo bug con más pasos.
 *
 *  Los segmentos dinámicos (`[id]`) sí se saltan: no son una URL literal que se pueda pedir. */
function rutasAutenticadasDelFilesystem(dir: string = APP_GROUP_DIR): string[] {
  const rutas: string[] = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entrada.isDirectory() || entrada.name.startsWith("[")) continue;
    if (entrada.name.startsWith("(")) {
      rutas.push(...rutasAutenticadasDelFilesystem(path.join(dir, entrada.name)));
      continue;
    }
    rutas.push(`/${entrada.name}`);
  }
  return [...new Set(rutas)].sort();
}

const PROTECTED_PATHS = rutasAutenticadasDelFilesystem();

/* Sub-rutas que además se prueban explícitamente: el matcher usa `:path*`, así que un
   error de sufijo dejaría el hijo abierto con el padre cerrado. */
const PROTECTED_SUBPATHS = ["/administracion/usuarios", "/gestion/pulso"];

const PUBLIC_PATHS = ["/", "/login", "/recuperar-clave", "/playground", "/aceptar-invitacion"];

test.describe("middleware: rutas protegidas (C0-13)", () => {
  test("el grupo (app) no está vacío (guarda contra un glob que no matchea nada)", () => {
    expect(PROTECTED_PATHS.length).toBeGreaterThanOrEqual(12);
    // Las dos pantallas de este PR tienen que estar en la lista derivada.
    expect(PROTECTED_PATHS).toContain("/alertas");
    expect(PROTECTED_PATHS).toContain("/conexiones");
  });

  for (const path of [...PROTECTED_PATHS, ...PROTECTED_SUBPATHS]) {
    test(`GET ${path} sin sesión → 307 a /login?redirect=${path}`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status()).toBe(307);
      const location = res.headers()["location"];
      expect(location).toBeDefined();
      expect(location).toContain("/login");
      expect(location).toContain(`redirect=${encodeURIComponent(path)}`);
    });
  }
});

test.describe("middleware: rutas públicas pasan sin redirect (C0-13)", () => {
  for (const path of PUBLIC_PATHS) {
    test(`GET ${path} sin sesión → 200 (no requiere auth)`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status()).toBe(200);
    });
  }
});
