import { describe, expect, it } from "vitest";
import { rovingIndex } from "./roving";

describe("a11y · rovingIndex", () => {
  it("→/↓ avanza con wrap", () => {
    expect(rovingIndex(0, "ArrowRight", 3)).toBe(1);
    expect(rovingIndex(2, "ArrowDown", 3)).toBe(0); // wrap
  });
  it("←/↑ retrocede con wrap", () => {
    expect(rovingIndex(1, "ArrowLeft", 3)).toBe(0);
    expect(rovingIndex(0, "ArrowUp", 3)).toBe(2); // wrap
  });
  it("teclas que no navegan → null", () => {
    expect(rovingIndex(0, "Enter", 3)).toBeNull();
    expect(rovingIndex(0, "a", 3)).toBeNull();
    expect(rovingIndex(0, "Tab", 3)).toBeNull();
  });
  it("grupo vacío → null", () => {
    expect(rovingIndex(0, "ArrowRight", 0)).toBeNull();
  });
});
