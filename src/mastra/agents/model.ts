// One place to switch provider. The brief proposes Claude through AWS Bedrock for
// deal data; the direct API is the sandbox default until that lands.
export const MODEL = process.env.MASTRA_MODEL ?? "anthropic/claude-sonnet-5-5";
