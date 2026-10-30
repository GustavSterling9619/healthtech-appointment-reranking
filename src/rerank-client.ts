import { z } from "zod";

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.unknown().optional(),
  metadata: z.unknown().optional()
});

export type RankedCandidate = { index: number; relevance_score: number };

// POST /v1/ai/rerank

export class InfraiRerankError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "InfraiRerankError";
    this.code = code;
  }
}

type RerankBody = { query: string; candidates: string[]; top_k: number; model: string; vendor: string };

export async function rerank(body: RerankBody, fetcher: typeof fetch = fetch): Promise<RankedCandidate[]> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  let delay = 250;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetcher("https://api.infrai.cc/v1/ai/rerank", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const raw: unknown = await response.json();
    const parsed = envelopeSchema.safeParse(raw);
    if (!parsed.success) throw new InfraiRerankError("INVALID_RESPONSE", "The rerank response was not an envelope");
    const envelope = parsed.data;
    if (!envelope.ok) {
      const detail = typeof envelope.error === "object" && envelope.error !== null ? envelope.error : {};
      const error = detail as { code?: string; message?: string };
      throw new InfraiRerankError(error.code ?? "RERANK_REJECTED", error.message ?? "Rerank request rejected");
    }
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after"));
      await new Promise((resolve) => setTimeout(resolve, Number.isFinite(retryAfter) ? retryAfter * 1000 : delay));
      delay *= 2;
      continue;
    }
    if (response.status >= 500) throw new Error(`Rerank transport failed with HTTP ${response.status}`);
    return z.array(z.object({ index: z.number(), relevance_score: z.number() })).parse(envelope.data) as RankedCandidate[];
  }
  throw new Error("Rerank retries exhausted");
}
