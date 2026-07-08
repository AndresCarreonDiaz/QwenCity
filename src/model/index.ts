import type { ModelAdapter } from "./adapter.ts";
import { MockAdapter } from "./mock.ts";

/**
 * The one place backend selection happens.
 *
 * MODEL_BACKEND=mock       (default) — fully offline, deterministic, $0.
 * MODEL_BACKEND=dashscope  — real Qwen Cloud (added once the voucher key lands;
 *                            will read DASHSCOPE_API_KEY and hit
 *                            dashscope-intl.aliyuncs.com). Not implemented yet
 *                            on purpose: nothing in the build depends on it.
 *
 * Swapping backends never touches a call site — that is the point of the seam.
 */
export function getModel(): ModelAdapter {
  const backend = process.env.MODEL_BACKEND ?? "mock";
  switch (backend) {
    case "mock":
      return new MockAdapter();
    case "dashscope":
      throw new Error(
        "dashscope backend not wired yet — pending Qwen Cloud voucher/API key. " +
          "Run with MODEL_BACKEND=mock (default) until then.",
      );
    default:
      throw new Error(`unknown MODEL_BACKEND: ${backend}`);
  }
}

export type { ModelAdapter } from "./adapter.ts";
