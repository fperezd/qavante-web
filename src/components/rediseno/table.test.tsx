import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TablePrimaryCell } from "./table";

describe("TablePrimaryCell — Ley 7", () => {
  it("el subtítulo largo envuelve y parte palabras, nunca usa truncado", () => {
    const html = renderToStaticMarkup(
      <TablePrimaryCell
        value="Contraparte completa"
        sub="Metadato largo que debe seguir visible incluso en una tabla angosta"
      />,
    );

    expect(html).toContain("whitespace-normal");
    expect(html).toContain("break-words");
    expect(html).not.toContain("truncate");
    expect(html).toContain('title="Metadato largo que debe seguir visible incluso en una tabla angosta"');
  });
});
