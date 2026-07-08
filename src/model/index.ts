import type { ModelAdapter } from "./adapter.ts";
import { DashScopeAdapter } from "./dashscope.ts";
import { MockAdapter } from "./mock.ts";

/**
 * The one place backend selection happens.
 *
 * MODEL_BACKEND=mock       (default) — fully offline, deterministic, $0.
 * MODEL_BACKEND=dashscope  — real Qwen Cloud. Reads DASHSCOPE_API_KEY (and
 *                            optionally DASHSCOPE_BASE_URL for the China region)
 *                            and hits the OpenAI-compatible endpoints.
 *
 * Swapping backends never touches a call site — that is the point of the seam.
 */
export function getModel(): ModelAdapter {
  const backend = process.env.MODEL_BACKEND ?? "mock";
  switch (backend) {
    case "mock":
      return new MockAdapter();
    case "dashscope": {
      const apiKey = process.env.DASHSCOPE_API_KEY;
      if (!apiKey) {
        throw new Error(
          "MODEL_BACKEND=dashscope but DASHSCOPE_API_KEY is not set. " +
            "Add it to a .env (gitignored) or the environment.",
        );
      }
      return new DashScopeAdapter({ apiKey, baseUrl: process.env.DASHSCOPE_BASE_URL });
    }
    default:
      throw new Error(`unknown MODEL_BACKEND: ${backend}`);
  }
}

export type { ModelAdapter } from "./adapter.ts";
