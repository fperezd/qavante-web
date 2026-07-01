import { describe, expect, it } from "vitest";
import { coverageInfo, deltaInfo, runwayTone, sparklinePoints } from "./inicio-v2-format";

describe("inicio-v2-format", () => {
  it("coverageInfo mapea los 3 estados", () => {
    expect(coverageInfo("covered")).toEqual({ tone: "success", label: "Cubierta" });
    expect(coverageInfo("tight").tone).toBe("warning");
    expect(coverageInfo("uncovered").tone).toBe("danger");
  });

  it("runwayTone por días", () => {
    expect(runwayTone(9)).toBe("danger");
    expect(runwayTone(20)).toBe("warning");
    expect(runwayTone(60)).toBe("success");
    expect(runwayTone(null)).toBe("neutral");
  });

  it("deltaInfo: higherIsBetter cambia el color", () => {
    expect(deltaInfo(8, true)?.tone).toBe("success"); // ventas suben = bueno
    expect(deltaInfo(8, false)?.tone).toBe("danger"); // gasto sube = malo
    expect(deltaInfo(-5, true)?.tone).toBe("danger");
    expect(deltaInfo(null)).toBeNull();
  });

  it("sparklinePoints normaliza al viewBox", () => {
    const pts = sparklinePoints([1, 2, 3], 100, 20).split(" ");
    expect(pts).toHaveLength(3);
    // primer x=0, último x=100
    expect(pts[0]?.startsWith("0.0,")).toBe(true);
    expect(pts[2]?.startsWith("100.0,")).toBe(true);
  });
});
