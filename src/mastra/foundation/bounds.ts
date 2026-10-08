import type { RequestContext } from "@mastra/core/request-context";
import { actorFrom } from "../tools/context";
import { costOf, tokensOf, type Usage } from "./cost";
import { isKilled, trackRun } from "./kill-switch";
import { versionOf } from "./registry";
import { ensureSession, recordActivity, setSessionStatus } from "./sessions";

// The bounds on one run: one DealLead turn of a deal review, so time parked for
// the DealLead between turns never counts (deal screening 05 §Bounds and Cost,
// and the brief's handoff decision).
export const BOUNDS = {
  wallClockMs: 60_000,
  steps: 25,
  specialistSteps: 8,
  costUsd: 0.5,
};

// Specialists that see only the prompt the supervisor writes, never the
// DealLead's conversation (05 §Mastra Mechanisms, messageFilter).
const PROMPT_ONLY = new Set(["task", "memo"]);

const HAND_BACK =
  "Stop now. Call no more specialists. Tell the DealLead which bound was reached, which criteria were checked, and that they can ask for the rest in a new review.";

interface RunState {
  model: string;
  rc: RequestContext;
  controller: AbortController;
  startedAt: number;
  sessionId?: string;
  runId?: string;
  costUsd: number;
  tokens: number;
  bound?: "wall clock" | "cost" | "kill switch";
  warned: boolean;
  ended: boolean;
  // Lets the kill switch find this run's session.
  tracked: { sessionId?: string; controller: AbortController };
  done: () => void;
}

const runs = new WeakMap<object, RunState>();

function startRun(rc: RequestContext, model: string): RunState {
  const actor = actorFrom({ requestContext: rc });
  const controller = new AbortController();
  const tracked = { controller, sessionId: undefined as string | undefined };
  const state: RunState = {
    model, rc, controller, startedAt: Date.now(), costUsd: 0, tokens: 0, warned: false, ended: false, tracked, done: () => {},
  };
  const untrack = trackRun(actor.tenantId, tracked);
  const timer = setTimeout(() => {
    state.bound = "wall clock";
    controller.abort(new Error(`Wall clock bound of ${BOUNDS.wallClockMs / 1000}s reached`));
    void endRun(state, "bound: wall clock");
  }, BOUNDS.wallClockMs);
  timer.unref?.();
  state.done = () => { clearTimeout(timer); untrack(); };
  void isKilled(actor.tenantId).then((killed) => {
    if (killed) {
      state.bound = "kill switch";
      controller.abort(new Error(`Agents are stopped in ${actor.tenantId}: the kill switch is engaged.`));
    }
  });
  return state;
}

async function bindSession(state: RunState, sessionId: string | undefined, runId?: string) {
  if (runId) state.runId ??= runId;
  if (state.sessionId || !sessionId) return;
  state.sessionId = sessionId;
  state.tracked.sessionId = sessionId;
  await ensureSession(sessionId, actorFrom({ requestContext: state.rc }));
  const actor = actorFrom({ requestContext: state.rc });
  await recordActivity({
    sessionId, runId: state.runId, actorType: "user", actorId: actor.userId,
    kind: "run.start", detail: { role: actor.role, tenantId: actor.tenantId },
  });
}

async function endRun(state: RunState, outcome: string, usage?: Usage) {
  if (state.ended) return;
  state.ended = true;
  state.done();
  const supervisorCost = costOf(usage, state.model);
  if (!state.sessionId) return;
  await recordActivity({
    sessionId: state.sessionId, runId: state.runId, actorType: "agent", actorId: "deal-review",
    agentVersion: versionOf("deal-review"), kind: "run.end",
    detail: {
      outcome,
      durationMs: Date.now() - state.startedAt,
      runCostUsd: state.costUsd + supervisorCost,
      bound: state.bound ?? null,
    },
    costUsd: supervisorCost,
    tokens: tokensOf(usage),
  });
  if (state.bound === "kill switch") await setSessionStatus(state.sessionId, "ended", "killed");
  else await setSessionStatus(state.sessionId, "parked", outcome);
}

function overCost(state: RunState, stepUsage?: Usage) {
  return state.costUsd + costOf(stepUsage, state.model) >= BOUNDS.costUsd;
}

// The supervisor's execution options for one run, resolved per call from its
// request context. Mastra may resolve these more than once per call, so the
// run's state is keyed on the request context.
export function runOptions(rc: RequestContext, model: string) {
  let state = runs.get(rc);
  if (!state) {
    state = startRun(rc, model);
    runs.set(rc, state);
  }
  const s = state;
  let supervisorUsage: Usage = {};

  return {
    maxSteps: BOUNDS.steps,
    abortSignal: s.controller.signal,
    onStepFinish: (step: { usage?: Usage }) => {
      const u = step.usage ?? {};
      supervisorUsage = {
        inputTokens: (supervisorUsage.inputTokens ?? 0) + (u.inputTokens ?? 0),
        outputTokens: (supervisorUsage.outputTokens ?? 0) + (u.outputTokens ?? 0),
        cachedInputTokens: (supervisorUsage.cachedInputTokens ?? 0) + (u.cachedInputTokens ?? 0),
      };
    },
    onIterationComplete: async ({ threadId, runId }: { threadId?: string; runId: string }) => {
      await bindSession(s, threadId ?? runId, runId);
      if (s.bound === "kill switch" || !overCost(s, supervisorUsage)) return;
      s.bound = "cost";
      if (!s.warned) {
        s.warned = true;
        return { continue: true, feedback: `Cost bound of $${BOUNDS.costUsd} reached. ${HAND_BACK}` };
      }
      return { continue: false };
    },
    onFinish: async (event: { totalUsage?: Usage; finishReason?: string }) => {
      await endRun(s, s.bound ? `bound: ${s.bound}` : event.finishReason ?? "stop", event.totalUsage ?? supervisorUsage);
    },
    onAbort: async () => {
      await endRun(s, `aborted${s.bound ? `: ${s.bound}` : ""}`, supervisorUsage);
    },
    onError: async ({ error }: { error: unknown }) => {
      await endRun(s, `error: ${error instanceof Error ? error.message : String(error)}`, supervisorUsage);
    },
    delegation: {
      onDelegationStart: async ({ primitiveId, threadId, runId, requestContext }: {
        primitiveId: string; threadId?: string; runId: string; requestContext: RequestContext;
      }) => {
        await bindSession(s, threadId ?? runId, runId);
        const sessionId = s.sessionId!;
        // Specialists' tools record against the supervisor's session.
        requestContext.set("sessionId", sessionId);

        const actor = actorFrom({ requestContext: s.rc });
        let rejection: string | undefined;
        if (await isKilled(actor.tenantId)) rejection = `Agents are stopped in ${actor.tenantId}: the kill switch is engaged.`;
        else if (overCost(s, supervisorUsage)) rejection = `Cost bound of $${BOUNDS.costUsd} reached. ${HAND_BACK}`;
        else if (Date.now() - s.startedAt >= BOUNDS.wallClockMs) rejection = `Wall clock bound reached. ${HAND_BACK}`;

        await recordActivity({
          sessionId, runId, actorType: "agent", actorId: primitiveId, agentVersion: versionOf(primitiveId),
          kind: rejection ? "delegation.rejected" : "delegation.start",
          detail: { delegatedBy: "deal-review", ...(rejection ? { reason: rejection } : {}) },
        });
        if (rejection) return { proceed: false, rejectionReason: rejection };
        return { modifiedMaxSteps: BOUNDS.specialistSteps };
      },
      messageFilter: ({ messages, primitiveId }: { messages: any[]; primitiveId: string }) =>
        PROMPT_ONLY.has(primitiveId) ? [] : messages,
      onDelegationComplete: async ({ primitiveId, runId, duration, success, result, error }: {
        primitiveId: string; runId: string; duration: number; success: boolean;
        result: { usage?: Usage }; error?: Error;
      }) => {
        const costUsd = costOf(result.usage, s.model);
        s.costUsd += costUsd;
        if (!s.sessionId) return;
        await recordActivity({
          sessionId: s.sessionId, runId, actorType: "agent", actorId: primitiveId, agentVersion: versionOf(primitiveId),
          kind: "delegation.complete",
          detail: { success, durationMs: duration, ...(error ? { error: error.message } : {}) },
          costUsd,
          tokens: tokensOf(result.usage),
        });
      },
    },
  };
}
