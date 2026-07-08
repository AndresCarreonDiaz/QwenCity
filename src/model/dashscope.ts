import type { CompleteOptions, ModelAdapter } from "./adapter.ts";

/**
 * Real Qwen Cloud adapter — the production counterpart to MockAdapter, hitting
 * DashScope's OpenAI-compatible endpoints. Because the whole app talks only to
 * the ModelAdapter interface, going live is `MODEL_BACKEND=dashscope` + a key;
 * no call site changes.
 *
 * The network call needs a key, but everything around it (endpoint + body
 * construction, task→model routing, auth, response parsing, retry) is unit-
 * tested with an injectable fetch, so this is verified up to the wire.
 */

/** minimal shape we use from a fetch response (keeps the fake in tests simple) */
export interface FetchLike {
  (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<{
    ok: boolean;
    status: number;
    json(): Promise<any>;
    text(): Promise<string>;
  }>;
}

export interface DashScopeOptions {
  apiKey: string;
  /** OpenAI-compatible base; default is the International endpoint */
  baseUrl?: string;
  /** fallback chat model when a task isn't routed */
  chatModel?: string;
  embedModel?: string;
  fetchImpl?: FetchLike;
  maxRetries?: number;
}

/** task label (from CompleteOptions.task) → Qwen model, per the cost-tier design */
const ROUTE: Record<string, string> = {
  act: "qwen-flash",
  importance: "qwen-flash",
  dialogue: "qwen-plus",
  post: "qwen-plus",
  "reflect-questions": "qwen3-max",
  "reflect-insights": "qwen3-max",
  plan: "qwen3-max",
};

const POIGNANCY_PROMPT = (text: string): string =>
  `On the scale of 1 to 10, where 1 is purely mundane (e.g., brushing teeth, making bed) and 10 is ` +
  `extremely poignant (e.g., a break up, college acceptance), rate the likely poignancy of the following ` +
  `piece of memory. Respond with a single integer only.\nMemory: ${text}\nRating:`;

export class DashScopeAdapter implements ModelAdapter {
  readonly name = "dashscope";
  readonly embedDim = 1024; // text-embedding-v4
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly chatModel: string;
  private readonly embedModel: string;
  private readonly fetchImpl: FetchLike;
  private readonly maxRetries: number;

  constructor(opts: DashScopeOptions) {
    if (!opts.apiKey) throw new Error("DashScopeAdapter requires an apiKey (DASHSCOPE_API_KEY)");
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? "https://dashscope-intl.aliyuncs.com/compatible-mode/v1").replace(/\/$/, "");
    this.chatModel = opts.chatModel ?? "qwen-plus";
    this.embedModel = opts.embedModel ?? "text-embedding-v4";
    this.fetchImpl = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
    this.maxRetries = opts.maxRetries ?? 2;
  }

  modelFor(task?: string): string {
    return (task && ROUTE[task]) || this.chatModel;
  }

  async embed(text: string): Promise<number[]> {
    const body = { model: this.embedModel, input: text };
    const json = await this.post("/embeddings", body);
    const vec = json?.data?.[0]?.embedding;
    if (!Array.isArray(vec)) throw new Error("DashScope embeddings: unexpected response shape");
    return vec as number[];
  }

  async complete(prompt: string, opts?: CompleteOptions): Promise<string> {
    const body = {
      model: this.modelFor(opts?.task),
      messages: [{ role: "user", content: prompt }],
      temperature: opts?.temperature ?? 0.7,
      ...(opts?.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    };
    const json = await this.post("/chat/completions", body);
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("DashScope chat: unexpected response shape");
    return content;
  }

  async scoreImportance(memoryText: string): Promise<number> {
    const raw = await this.complete(POIGNANCY_PROMPT(memoryText), { task: "importance", temperature: 0, maxTokens: 4 });
    const m = raw.match(/\d+/);
    const n = m ? parseInt(m[0]!, 10) : 1;
    return Math.max(1, Math.min(10, Number.isFinite(n) ? n : 1));
  }

  private async post(path: string, body: unknown): Promise<any> {
    const url = this.baseUrl + path;
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const res = await this.fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(body),
      });
      if (res.ok) return res.json();
      // retry only transient failures (rate limit / server error)
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`DashScope ${path} ${res.status}: ${await safeText(res)}`);
        continue;
      }
      throw new Error(`DashScope ${path} ${res.status}: ${await safeText(res)}`);
    }
    throw lastErr ?? new Error(`DashScope ${path}: exhausted retries`);
  }
}

async function safeText(res: { text(): Promise<string> }): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return "(no body)";
  }
}
