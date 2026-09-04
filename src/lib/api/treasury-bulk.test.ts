import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.hoisted(() => vi.fn());

vi.mock("./client", () => ({ api: { post } }));

import { classifyBankMovementsBulk } from "./treasury";

describe("classifyBankMovementsBulk", () => {
  beforeEach(() => post.mockReset());

  it("usa el endpoint atómico de API #350 y conserva la idempotency_key elegida por la vista", async () => {
    const body = {
      movement_ids: ["mov-1", "mov-2", "mov-3"],
      management_account_id: "account-1",
      idempotency_key: "key-1",
    };
    post.mockResolvedValueOnce({ items: [], reversible: false, action_id: null });

    await classifyBankMovementsBulk(body);
    expect(post).toHaveBeenCalledWith("/api/treasury/bank-movements/classify-bulk", { body });
  });
});
