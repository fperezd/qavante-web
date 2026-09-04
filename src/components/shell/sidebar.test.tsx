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
});
