import { RequestContext } from "@mastra/core/request-context";

// A tool call as an agent in a session makes it, for calling tools directly.
export function ctx(opts: { agentId?: string; sessionId?: string; role?: "DealLead" | "Analyst"; userId?: string; tenantId?: string } = {}) {
  const requestContext = new RequestContext();
  requestContext.set("sessionId", opts.sessionId ?? "S-test");
  requestContext.set("userRole", opts.role ?? "DealLead");
  requestContext.set("userId", opts.userId ?? "U-1");
  requestContext.set("tenantId", opts.tenantId ?? "T-demo");
  return {
    requestContext,
    agent: { agentId: opts.agentId ?? "direct", toolCallId: "t", messages: [], suspend: async () => {} },
  } as any;
}

// Run a tool's execute with a context; tools are typed loosely here on purpose.
export async function call(tool: { execute?: (...args: any[]) => any }, input: unknown, context = ctx()): Promise<any> {
  return tool.execute!(input, context);
}
