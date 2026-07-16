import { describe, expect, it } from "vitest";
import { estadoConexionPrevired } from "./previred-estado-conexion-model";

const base = { cargando: false, error: false, claveActiva: false, permisoValido: false };

describe("estadoConexionPrevired", () => {
  it("cargando: no afirma nada todavía", () => {
    expect(estadoConexionPrevired({ ...base, cargando: true })).toMatchObject({
      tono: "neutro",
      detalle: "",
    });
  });

  it("un error NO se pinta como 'falta' — no sabemos qué falta", () => {
    const r = estadoConexionPrevired({ ...base, error: true, claveActiva: true });
    expect(r.tono).toBe("neutro");
    expect(r.titulo).toMatch(/no pudimos leer/i);
  });

  it("cargando gana sobre error (todavía no terminó de preguntar)", () => {
    expect(estadoConexionPrevired({ ...base, cargando: true, error: true }).detalle).toBe("");
  });

  // El caso que reportó Fernando: autorizó y el formulario quedó vacío.
  it("con permiso y sin clave dice que falta la clave, no 'listo'", () => {
    const r = estadoConexionPrevired({ ...base, permisoValido: true });
    expect(r.tono).toBe("falta");
    expect(r.titulo).toMatch(/falta la clave/i);
    expect(r.detalle).toMatch(/autorizar no guarda la clave/i);
  });

  it("con clave y sin permiso dice que falta autorizar", () => {
    const r = estadoConexionPrevired({ ...base, claveActiva: true });
    expect(r.tono).toBe("falta");
    expect(r.titulo).toMatch(/falta autorizar/i);
  });

  it("sin nada: dice que faltan los dos pasos", () => {
    const r = estadoConexionPrevired(base);
    expect(r.tono).toBe("falta");
    expect(r.detalle).toMatch(/los dos pasos/i);
  });

  it("con los dos pasos: ok, pero sin prometer que las cotizaciones ya llegan", () => {
    const r = estadoConexionPrevired({ ...base, claveActiva: true, permisoValido: true });
    expect(r.tono).toBe("ok");
    // El sync todavía no está cableado en CC-API (ADR-0070 §Wiring): no prometer Pagar.
    expect(r.detalle).toMatch(/no aparecen en Pagar|falta activar la sincronización/i);
  });
});
