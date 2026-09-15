import { afterEach, describe, expect, it, vi } from "vitest";
import { watchSantiagoDay } from "./cash-projection-run-panel";

describe("watchSantiagoDay", () => {
  afterEach(() => vi.useRealTimers());

  it("invalida el snapshot al cruzar medianoche en Santiago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-23T02:59:50Z"));
    const changed = vi.fn();
    const stop = watchSantiagoDay(changed);

    vi.advanceTimersByTime(15_000);
    expect(changed).toHaveBeenCalledOnce();
    expect(changed).toHaveBeenCalledWith("2026-09-23");
    stop();
  });
});
