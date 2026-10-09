import { describe, expect, it } from "vitest";
import type { SourceStatus } from "@/lib/api/sources-status";
import {
  estadoConexiones,
  estadoCredenciales,
  estadoEmpresas,
  estadoReglas,
  resumenReglas,
  estadoUsuarios,
  filasHubV12,
  type CargaV12,
} from "./administracion-v12-model";

function source(overrides: Partial<SourceStatus> = {}): SourceStatus {
  return {
    source: "sii_rcv",
    display_name: "SII",
    state: "ok",
    reason: null,
    last_sync: null,
    ...overrides,
  } as SourceStatus;
}

/** Atajo de test para la rama `"listo"` de `CargaV12<T>` — las otras dos ramas
 *  (`cargando`/`error`) no llevan `valor`, así que se escriben literales en cada test. */
function listo<T>(valor: T): CargaV12<T> {
  return { tipo: "listo", valor };
}
const CARGANDO: CargaV12<never> = { tipo: "cargando" };
const ERROR: CargaV12<never> = { tipo: "error" };

/* `concordar` se movió a `src/lib/formatters/count.ts` (issue #94) — su cobertura genérica
 * vive en `count.test.ts`. Lo que este archivo sigue fijando es el TEXTO real que produce
 * `estadoEmpresas`/`estadoUsuarios`/`estadoCredenciales` con N=1, más abajo. */

describe("estadoConexiones — Ley 1, misma fuente que el hub Conexiones", () => {
  it("cargando usa texto de conexiones, no el de credenciales", () => {
    expect(estadoConexiones(CARGANDO)).toEqual({
      tono: "neutral",
      texto: "Revisando conexiones…",
    });
  });

  it("con acción pendiente no añade el sufijo de Renovar de credenciales", () => {
    expect(estadoConexiones(listo([source({ state: "missing" })]))).toEqual({
      tono: "warn",
      texto: "1 requiere tu acción",
    });
  });
});

describe("estadoCredenciales — Ley 1, misma fuente que V11", () => {
  it("cargando → estado propio 'Cargando…' (tono neutral), NUNCA null", () => {
    expect(estadoCredenciales(CARGANDO)).toEqual({
      tono: "neutral",
      texto: "Cargando credenciales…",
    });
  });

  it("error → estado propio 'No se pudo cargar' (tono bad) — no se pinta como sin dato", () => {
    expect(estadoCredenciales(ERROR)).toEqual({ tono: "bad", texto: "No se pudo cargar" });
  });

  it("cargando y error son estados DISTINTOS entre sí (no colapsan al mismo texto/tono)", () => {
    expect(estadoCredenciales(CARGANDO)).not.toEqual(estadoCredenciales(ERROR));
  });

  it("sin fuentes visibles con problema → Al día (tono ok)", () => {
    const estado = estadoCredenciales(listo([source({ state: "ok" })]));
    expect(estado).toEqual({ tono: "ok", texto: "Al día" });
  });

  it("[] (cero fuentes) → Al día: no hay ninguna que requiera acción", () => {
    expect(estadoCredenciales(listo([]))).toEqual({ tono: "ok", texto: "Al día" });
  });

  it("UNA fuente en error (missing) → singular 'requiere', no 'requieren'", () => {
    const estado = estadoCredenciales(listo([source({ state: "missing" })]));
    expect(estado).toEqual({ tono: "warn", texto: "1 requiere tu acción → Renovar" });
  });

  it("dos fuentes en error → plural 'requieren'", () => {
    const estado = estadoCredenciales(
      listo([
        source({ source: "sii_rcv", state: "missing" }),
        source({ source: "bank_bice", state: "error", reason: "upstream: auth_error: x" }),
      ]),
    );
    expect(estado).toEqual({ tono: "warn", texto: "2 requieren tu acción → Renovar" });
  });

  it("una fuente OK y otra con error → cuenta sólo la que requiere acción (no todas)", () => {
    const estado = estadoCredenciales(
      listo([
        source({ source: "sii_rcv", state: "ok" }),
        source({ source: "bank_bice", state: "missing" }),
      ]),
    );
    expect(estado).toEqual({ tono: "warn", texto: "1 requiere tu acción → Renovar" });
  });

  it("una fuente 'stale' (no es del dueño) NO cuenta como acción requerida", () => {
    const estado = estadoCredenciales(listo([source({ state: "stale" })]));
    expect(estado).toEqual({ tono: "ok", texto: "Al día" });
  });

  it("fuentes OCULTAS (tgr) no se cuentan ni para bien ni para mal", () => {
    const estado = estadoCredenciales(listo([source({ source: "tgr", state: "missing" })]));
    expect(estado).toEqual({ tono: "ok", texto: "Al día" });
  });
});

describe("estadoEmpresas", () => {
  it("cargando → 'Cargando…', NUNCA null", () => {
    expect(estadoEmpresas(CARGANDO)).toEqual({ tono: "neutral", texto: "Cargando empresas…" });
  });

  it("error → 'No se pudo cargar' (tono bad)", () => {
    expect(estadoEmpresas(ERROR)).toEqual({ tono: "bad", texto: "No se pudo cargar" });
  });

  it("n=1 → singular 'empresa'", () => {
    expect(estadoEmpresas(listo(1))).toEqual({ tono: "neutral", texto: "1 empresa" });
  });

  it("n=3 → plural 'empresas'", () => {
    expect(estadoEmpresas(listo(3))).toEqual({ tono: "neutral", texto: "3 empresas" });
  });
});

describe("estadoUsuarios", () => {
  it("cargando → 'Cargando…', NUNCA null", () => {
    expect(estadoUsuarios(CARGANDO)).toEqual({ tono: "neutral", texto: "Cargando usuarios…" });
  });

  it("error → 'No se pudo cargar' (tono bad)", () => {
    expect(estadoUsuarios(ERROR)).toEqual({ tono: "bad", texto: "No se pudo cargar" });
  });

  it("n=1 → singular 'usuario'", () => {
    expect(estadoUsuarios(listo(1))).toEqual({ tono: "neutral", texto: "1 usuario" });
  });

  it("n=5 → plural 'usuarios'", () => {
    expect(estadoUsuarios(listo(5))).toEqual({ tono: "neutral", texto: "5 usuarios" });
  });
});

describe("estadoReglas", () => {
  it("no convierte fuentes sin trazabilidad en cero aplicaciones", () => {
    expect(
      estadoReglas(
        listo({ activas: 1, aplicaciones: 0, correcciones: 0, medidas: 0, sinMedicion: 1 }),
      ),
    ).toEqual({ tono: "neutral", texto: "1 regla activa · uso sin dato en 1 regla" });
  });

  it("declara el alcance cuando sólo una parte tiene medición", () => {
    expect(
      estadoReglas(
        listo({ activas: 3, aplicaciones: 7, correcciones: 1, medidas: 2, sinMedicion: 1 }),
      )?.texto,
    ).toBe(
      "3 reglas activas · 7 aplicaciones y 1 corrección en 2 reglas medidas · 1 regla sin medición",
    );
  });

  it("con cobertura completa conserva singular y plural", () => {
    expect(
      estadoReglas(
        listo({ activas: 1, aplicaciones: 1, correcciones: 0, medidas: 1, sinMedicion: 0 }),
      )?.texto,
    ).toBe("1 regla activa · 1 aplicación y 0 correcciones en 1 regla medida");
  });
});

describe("resumenReglas", () => {
  it("una fuente desconocida no suma cero al universo medido", () => {
    expect(
      resumenReglas(
        [{ active: true }, { active: false }],
        [
          {
            coverage: "complete_since_tracking_started_at",
            application_count: 7,
            correction_count: 1,
          },
          { coverage: "unknown", application_count: null, correction_count: null },
        ],
      ),
    ).toEqual({ activas: 1, aplicaciones: 7, correcciones: 1, medidas: 1, sinMedicion: 1 });
  });

  it.each([
    {
      coverage: "complete_since_tracking_started_at" as const,
      application_count: null,
      correction_count: null,
    },
    { coverage: "complete_since_tracking_started_at" as const },
  ])("conteos nulos o ausentes fallan cerrados como sin medición", (uso) => {
    expect(resumenReglas([{ active: true }], [uso])).toEqual({
      activas: 1,
      aplicaciones: 0,
      correcciones: 0,
      medidas: 0,
      sinMedicion: 1,
    });
  });
});

describe("filasHubV12", () => {
  const inputsBase = {
    sources: CARGANDO as CargaV12<SourceStatus[]>,
    empresas: CARGANDO as CargaV12<number>,
    usuarios: CARGANDO as CargaV12<number>,
    reglas: CARGANDO as CargaV12<{
      activas: number;
      aplicaciones: number;
      correcciones: number;
      medidas: number;
      sinMedicion: number;
    }>,
    mcpVisible: false,
  };

  it("sin mcp: 10 filas, en el orden de la grilla actual", () => {
    const filas = filasHubV12(inputsBase);
    expect(filas.map((f) => f.id)).toEqual([
      "empresas",
      "usuarios",
      "credenciales",
      "conexiones",
      "estructura-gestion",
      "vistas-gestion",
      "monedas",
      "remuneraciones",
      "reglas-clasificacion",
      "plantillas",
    ]);
  });

  it("con mcpVisible: agrega la fila 'mcp' AL FINAL", () => {
    const filas = filasHubV12({ ...inputsBase, mcpVisible: true });
    expect(filas).toHaveLength(11);
    expect(filas.at(-1)!.id).toBe("mcp");
  });

  it("cada fila SIN estado calculado (hueco declarado) trae estado null, no un objeto vacío", () => {
    const filas = filasHubV12(inputsBase);
    const sinEstado = filas.filter(
      (f) =>
        f.id !== "credenciales" &&
        f.id !== "conexiones" &&
        f.id !== "empresas" &&
        f.id !== "usuarios" &&
        f.id !== "reglas-clasificacion",
    );
    expect(sinEstado.length).toBeGreaterThan(0);
    for (const f of sinEstado) expect(f.estado).toBeNull();
  });

  it("credenciales/empresas/usuarios propagan el estado calculado desde los inputs", () => {
    const filas = filasHubV12({
      sources: listo([source({ state: "missing" })]),
      empresas: listo(2),
      usuarios: listo(7),
      reglas: listo({
        activas: 2,
        aplicaciones: 4,
        correcciones: 1,
        medidas: 2,
        sinMedicion: 0,
      }),
      mcpVisible: false,
    });
    const porId = Object.fromEntries(filas.map((f) => [f.id, f]));
    expect(porId.credenciales!.estado).toEqual({
      tono: "warn",
      texto: "1 requiere tu acción → Renovar",
    });
    expect(porId.empresas!.estado).toEqual({ tono: "neutral", texto: "2 empresas" });
    expect(porId.usuarios!.estado).toEqual({ tono: "neutral", texto: "7 usuarios" });
  });

  it("las tres filas con fuente son INDEPENDIENTES entre sí: una en error no tumba a las otras", () => {
    const filas = filasHubV12({
      sources: ERROR,
      empresas: listo(2),
      usuarios: CARGANDO,
      reglas: listo({
        activas: 2,
        aplicaciones: 4,
        correcciones: 1,
        medidas: 2,
        sinMedicion: 0,
      }),
      mcpVisible: false,
    });
    const porId = Object.fromEntries(filas.map((f) => [f.id, f]));
    expect(porId.credenciales!.estado).toEqual({ tono: "bad", texto: "No se pudo cargar" });
    expect(porId.empresas!.estado).toEqual({ tono: "neutral", texto: "2 empresas" });
    expect(porId.usuarios!.estado).toEqual({ tono: "neutral", texto: "Cargando usuarios…" });
  });

  it("cada fila trae href único (no dos filas apuntan al mismo lado)", () => {
    const filas = filasHubV12({ ...inputsBase, mcpVisible: true });
    const hrefs = filas.map((f) => f.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("cada fila trae título y descripción no vacíos", () => {
    const filas = filasHubV12({ ...inputsBase, mcpVisible: true });
    for (const f of filas) {
      expect(f.titulo.trim().length).toBeGreaterThan(0);
      expect(f.descripcion.trim().length).toBeGreaterThan(0);
    }
  });
});
