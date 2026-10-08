// Dollar cost of model usage, for the per-request cap in deal screening 05
// §Bounds and Cost. First-party API rates per million tokens; Bedrock bills
// separately, so set MASTRA_PRICE_* once that provider lands.

interface Rates { input: number; output: number; cacheRead: number }

const RATES: Record<string, Rates> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
};

// An unknown model is priced at the most expensive known rate, so the cap errs
// toward stopping early.
const FALLBACK = RATES["claude-opus-5-5"];

export interface Usage {
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  totalTokens?: number;
}

function ratesFor(model: string): Rates {
  const env = process.env;
  if (env.MASTRA_PRICE_INPUT && env.MASTRA_PRICE_OUTPUT) {
    return {
      input: Number(env.MASTRA_PRICE_INPUT),
      output: Number(env.MASTRA_PRICE_OUTPUT),
      cacheRead: Number(env.MASTRA_PRICE_CACHE_READ ?? env.MASTRA_PRICE_INPUT),
    };
  }
  const key = Object.keys(RATES).find((k) => model.includes(k));
  return key ? RATES[key] : FALLBACK;
}

export function costOf(usage: Usage | undefined, model: string): number {
  if (!usage) return 0;
  const r = ratesFor(model);
  const cached = usage.cachedInputTokens ?? 0;
  const fresh = Math.max(0, (usage.inputTokens ?? 0) - cached);
  return (fresh * r.input + cached * r.cacheRead + (usage.outputTokens ?? 0) * r.output) / 1_000_000;
}

export function tokensOf(usage: Usage | undefined): number {
  if (!usage) return 0;
  return usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
}
