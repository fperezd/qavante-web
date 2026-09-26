import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_COMPANY_STORAGE_KEY,
  companyRequestHeaders,
  explicitCompanyRequestHeaders,
} from "./active-company";

const memoria = new Map<string, string>();

describe("companyRequestHeaders", () => {
  afterEach(() => {
    memoria.clear();
    vi.unstubAllGlobals();
  });

  function conStorage() {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => memoria.get(key) ?? null,
        setItem: (key: string, value: string) => {
          memoria.set(key, value);
        },
        removeItem: (key: string) => {
          memoria.delete(key);
        },
      },
    });
  }

  it("no manda sociedad al listar las razones sociales", () => {
    conStorage();
    window.localStorage.setItem(ACTIVE_COMPANY_STORAGE_KEY, "sociedad-a");
    expect(companyRequestHeaders("/api/legal-entities")).toEqual({});
  });

  it("manda la sociedad activa en el resto de las lecturas", () => {
    conStorage();
    window.localStorage.setItem(ACTIVE_COMPANY_STORAGE_KEY, "sociedad-a");
    expect(companyRequestHeaders("/api/bank-movements")).toEqual({
      "X-Qavante-Company-Id": "sociedad-a",
    });
  });

  it("manda lo no atribuido como alcance propio", () => {
    conStorage();
    window.localStorage.setItem(ACTIVE_COMPANY_STORAGE_KEY, "unattributed");
    expect(companyRequestHeaders("/api/bank-movements")).toEqual({
      "X-Qavante-Company-Id": "unattributed",
    });
    expect(companyRequestHeaders("/api/legal-entities")).toEqual({});
  });

  it("conserva una sociedad ya resuelta aunque todavia no este en storage", () => {
    conStorage();
    expect(explicitCompanyRequestHeaders("sociedad-primer-render")).toEqual({
      "X-Qavante-Company-Id": "sociedad-primer-render",
    });
    expect(explicitCompanyRequestHeaders(null)).toEqual({});
  });
});
