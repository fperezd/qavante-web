import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/inicio",
}));

vi.mock("./company-switcher", () => ({
  CompanySwitcher: () => null,
}));

import { AppSidebar } from "./sidebar";

function html(bandejaEnabled?: boolean, financiamientoEnabled?: boolean) {
  return renderToStaticMarkup(
    <AppSidebar
      mobileOpen={false}
      onCloseMobile={() => undefined}
      userRole="owner"
      bandejaEnabled={bandejaEnabled}
      financiamientoEnabled={financiamientoEnabled}
    />,
  );
}

describe("AppSidebar · Bandeja V07", () => {
  it("muestra la entrada a Bandeja sólo con el flag habilitado", () => {
    expect(html(true)).toContain('href="/bandeja"');
    expect(html(false)).not.toContain('href="/bandeja"');
  });

  it("ubica Bandeja inmediatamente después de Inicio y antes de Cobros y pagos", () => {
    const rendered = html(true);

    expect(rendered.indexOf('href="/inicio"')).toBeLessThan(rendered.indexOf('href="/bandeja"'));
    expect(rendered.indexOf('href="/bandeja"')).toBeLessThan(rendered.indexOf("Cobros y pagos"));
    expect(rendered.match(/href="\/bandeja"/g)).toHaveLength(1);
  });
});

describe("AppSidebar · Financiamiento V13", () => {
  it("muestra Financiamiento sólo con el flag habilitado", () => {
    const route = /href="\/financiamiento"/;
    expect(html(false, true)).toMatch(route);
    expect(html(false, false)).not.toMatch(route);
  });
});
