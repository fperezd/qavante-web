import { describe, it, expect, beforeEach } from "vitest";
import {
  deferSource,
  undeferSource,
  getDeferredSources,
  resetDeferredSources,
} from "./deferred-sources";

/* Store de fuentes diferidas ("conectar después"). En memoria por sesión de
   navegación mientras el backend no persista el diferimiento. */

describe("deferred-sources", () => {
  beforeEach(() => resetDeferredSources());

  it("arranca vacío", () => {
    expect(getDeferredSources()).toEqual([]);
  });

  it("deferSource agrega y es idempotente", () => {
    deferSource("sii");
    deferSource("sii");
    expect(getDeferredSources()).toEqual(["sii"]);
  });

  it("undeferSource saca la fuente (retomar la conexión) y es idempotente", () => {
    deferSource("sii");
    deferSource("bank");
    undeferSource("sii");
    undeferSource("sii");
    expect(getDeferredSources()).toEqual(["bank"]);
  });

  it("el snapshot es inmutable: mutarlo desde fuera no corrompe el store", () => {
    deferSource("bank");
    const snap = getDeferredSources();
    expect(() => (snap as string[]).push("sii")).toThrow();
    expect(getDeferredSources()).toEqual(["bank"]);
  });

  it("la referencia del snapshot cambia solo cuando cambia el contenido", () => {
    const before = getDeferredSources();
    deferSource("sii");
    const after = getDeferredSources();
    expect(after).not.toBe(before);
    deferSource("sii"); // no-op
    expect(getDeferredSources()).toBe(after);
  });
});
