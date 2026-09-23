import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { clearCacheForCompanyChange, isKnownCompany } from "./company-scope";

describe("company scope cache boundary", () => {
  it("removes every cached operational result when Empresa changes", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["treasury", "cash", "tenant-a"], { company: "A", amount: 100 });
    queryClient.setQueryData(["dashboard", "summary"], { company: "A", score: 91 });
    queryClient.setQueryData(["legal-entities"], { entities: [{ id: "A" }, { id: "B" }] });

    clearCacheForCompanyChange(queryClient);

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});

describe("company selection after creation", () => {
  it("accepts an Empresa returned by the refreshed list even with a stale render", () => {
    const queryClient = new QueryClient();
    const previous = [{ id: "A" }] as Parameters<typeof isKnownCompany>[1];
    queryClient.setQueryData(["legal-entities"], { entities: [{ id: "A" }, { id: "B" }] });

    expect(isKnownCompany(queryClient, previous, "B")).toBe(true);
    expect(isKnownCompany(queryClient, previous, "C")).toBe(false);
  });
});
