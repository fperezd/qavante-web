import { describe, expect, it } from "vitest";

import {
  emDashesOutsideComments,
  visibleCopyWithEmDash,
} from "../../scripts/visible-copy-punctuation.mjs";

describe("copy visible", () => {
  it("usa punto medio, no raya larga, en app y componentes", () => {
    expect(visibleCopyWithEmDash()).toEqual([]);
  }, 10_000);

  it("no convierte comentarios de línea, bloque ni JSDoc en falsos positivos", () => {
    expect(emDashesOutsideComments("// contrato — no es copy\nconst copy = 'A · B';")).toEqual([]);
    expect(emDashesOutsideComments("/* contrato — no es copy */\nconst copy = 'A · B';")).toEqual(
      [],
    );
    expect(emDashesOutsideComments("/** contrato — no es copy */\nconst copy = 'A · B';")).toEqual(
      [],
    );
    expect(emDashesOutsideComments("const copy = 'A — B';")).toEqual([16]);
  });
});
