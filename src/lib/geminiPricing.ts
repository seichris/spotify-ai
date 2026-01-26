export type GeminiPricing = {
  inputPer1M: number;
  outputPer1M: number;
  status: "Stable" | "Latest" | "Preview";
};

export const GEMINI_MODEL_PRICING: Record<string, GeminiPricing> = {
  "gemini-2.5-pro": {
    inputPer1M: 1.25,
    outputPer1M: 10,
    status: "Stable",
  },
  "gemini-3.0-flash": {
    inputPer1M: 0.5,
    outputPer1M: 3,
    status: "Latest",
  },
  "gemini-2.5-flash": {
    inputPer1M: 0.3,
    outputPer1M: 2.5,
    status: "Stable",
  },
  "gemini-3.0-pro-preview": {
    inputPer1M: 2,
    outputPer1M: 12,
    status: "Preview",
  },
};

export const estimateGeminiCost = (
  model: string,
  promptTokens: number,
  candidatesTokens: number
) => {
  const pricing = GEMINI_MODEL_PRICING[model];
  if (!pricing) return null;
  const inputCost = (promptTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (candidatesTokens / 1_000_000) * pricing.outputPer1M;
  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    pricing,
  };
};
