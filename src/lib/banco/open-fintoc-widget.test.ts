import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api/client";
import { completeFintocWidget, openOfficialFintocWidget } from "./open-fintoc-widget";

vi.mock("@/lib/api/client", () => ({
  api: {
    post: vi.fn().mockResolvedValue({ status: "ok", accounts: 0, imported: 0, per_account: [] }),
    get: vi.fn(),
  },
}));

describe("completeFintocWidget", () => {
  beforeEach(() => vi.clearAllMocks());

  it("envía el exchange_token del callback nuevo", async () => {
    const callback = { exchangeToken: "li_new_exchange_token_123" };
    await completeFintocWidget(callback, "company-1");

    expect(api.post).toHaveBeenCalledWith("/api/fintoc/complete", {
      headers: { "X-Qavante-Company-Id": "company-1" },
      body: {
        exchange_token: "li_new_exchange_token_123",
        legal_entity_id: "company-1",
        link: callback,
      },
    });
  });

  it("reintenta con el titular elegido sin reutilizar el exchange_token", async () => {
    await completeFintocWidget(null, "company-2");

    expect(api.post).toHaveBeenCalledWith("/api/fintoc/complete", {
      headers: { "X-Qavante-Company-Id": "company-2" },
      body: { legal_entity_id: "company-2" },
    });
  });
});

describe("openOfficialFintocWidget", () => {
  const open = vi.fn();
  const create = vi.fn(() => ({ open }));

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("window", { Fintoc: { create } });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("crea un link intent Business y abre su widget", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      public_key: "pk_test_example",
      widget_token: "li_widget_test_123",
      holder_type: "business",
      country: "cl",
      product: "movements",
      webhook_url: null,
      connected: false,
    });

    await openOfficialFintocWidget({
      legalEntityId: "company-1",
      onSuccess: vi.fn(),
    });

    expect(api.post).toHaveBeenCalledWith("/api/fintoc/link-intent", {
      headers: { "X-Qavante-Company-Id": "company-1" },
      body: { holder_type: "business" },
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        publicKey: "pk_test_example",
        widgetToken: "li_widget_test_123",
      }),
    );
    expect(open).toHaveBeenCalledOnce();
  });

  it("usa Business cuando el llamador no declara titular", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      public_key: "pk_test_example",
      widget_token: "li_widget_test_123",
      holder_type: "business",
      country: "cl",
      product: "movements",
      webhook_url: null,
      connected: false,
    });

    await openOfficialFintocWidget({ legalEntityId: "company-1", onSuccess: vi.fn() });

    expect(api.post).toHaveBeenCalledWith("/api/fintoc/link-intent", {
      headers: { "X-Qavante-Company-Id": "company-1" },
      body: { holder_type: "business" },
    });
    expect(open).toHaveBeenCalledOnce();
  });

  it("atribuye el link intent a la sociedad explícita sin depender de storage", async () => {
    vi.stubGlobal("window", {
      Fintoc: { create },
      localStorage: { getItem: vi.fn(() => null) },
    });
    vi.mocked(api.post).mockResolvedValueOnce({
      public_key: "pk_test_example",
      widget_token: "li_widget_test_123",
      holder_type: "business",
      country: "cl",
      product: "movements",
      webhook_url: null,
      connected: false,
    });

    await openOfficialFintocWidget({
      legalEntityId: "company-first-render",
      onSuccess: vi.fn(),
    });

    expect(api.post).toHaveBeenCalledWith("/api/fintoc/link-intent", {
      headers: { "X-Qavante-Company-Id": "company-first-render" },
      body: { holder_type: "business" },
    });
  });

  it("no abre el widget si la API rechaza el link intent", async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error("intent unavailable"));

    await expect(
      openOfficialFintocWidget({ legalEntityId: "company-fallback", onSuccess: vi.fn() }),
    ).rejects.toThrow("intent unavailable");
    expect(api.get).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it("falla cerrado antes de consultar Fintoc si no hay sociedad activa", async () => {
    await expect(
      openOfficialFintocWidget({ legalEntityId: "", onSuccess: vi.fn() }),
    ).rejects.toThrow("No hay una sociedad activa");
    expect(api.post).not.toHaveBeenCalled();
    expect(api.get).not.toHaveBeenCalled();
  });
});
