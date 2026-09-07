import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/inicio",
}));

vi.mock("./company-switcher", () => ({
  CompanySwitcher: () => null,
}));

import { AppSidebar } from "./sidebar";

function html(bandejaEnabled?: boolean) {
  return renderToStaticMarkup(
    <AppSidebar
      mobileOpen={false}
      onCloseMobile={() => undefined}
      userRole="owner"
      bandejaEnabled={bandejaEnabled}
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
