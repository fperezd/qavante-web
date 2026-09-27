import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { api } from "./client";
import type { ReceivableDocumentsResponse } from "./cobranza";
import { server } from "@/test/msw/node";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api.test";
});

const API_BASE = "http://api.test";

describe("GET /accounts-receivable/documents · contrato #837", () => {
  it("preserva collected=null y su cobertura, sin coerción de transporte", async () => {
    server.use(
      http.get(`${API_BASE}/api/treasury/accounts-receivable/documents`, () =>
        HttpResponse.json({
          items: [],
          total: 0,
          limit: 100,
          offset: 0,
          overdue: [],
          due_soon: [],
          collected: null,
          collected_coverage: "unverified_legacy_collections",
          collected_reason: "legacy_collection_lineage_unavailable",
          generated_at: "2026-09-26T00:00:00Z",
        } satisfies ReceivableDocumentsResponse),
      ),
    );

    await expect(
      api.get<ReceivableDocumentsResponse>("/api/treasury/accounts-receivable/documents"),
    ).resolves.toMatchObject({
      collected: null,
      collected_coverage: "unverified_legacy_collections",
      collected_reason: "legacy_collection_lineage_unavailable",
    });
  });
});
