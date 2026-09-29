import { describe, expect, it, vi } from "vitest";
import { selectCompanyAndReload } from "./company-switcher";

describe("company switcher", () => {
  it("recarga después de guardar una sociedad distinta", () => {
    const calls: string[] = [];

    selectCompanyAndReload(
      "sociedad-a",
      "sociedad-b",
      (id) => calls.push(`select:${id}`),
      () => calls.push("reload"),
    );

    expect(calls).toEqual(["select:sociedad-b", "reload"]);
  });

  it("no recarga al elegir la sociedad que ya está activa", () => {
    const selectCompany = vi.fn();
    const reload = vi.fn();

    selectCompanyAndReload("sociedad-a", "sociedad-a", selectCompany, reload);

    expect(selectCompany).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});
