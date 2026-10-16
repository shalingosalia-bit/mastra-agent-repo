import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { auth, type OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { OAuthClientInformationMixed, OAuthClientMetadata, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";

// The app's own connection to the Dealpath MCP server, as the signed-in User.
// The server only accepts OAuth sign-in in a browser, so a person connects once
// at /poc/dealpath/connect and the tokens are kept outside the repository. The
// app asks for mcp:read only: every change stays a proposal inside the app.

export const DEALPATH_MCP_URL = process.env.DEALPATH_MCP_URL ?? "https://mcp.dealpath.com/mcp";
const APP_ORIGIN = process.env.POC_APP_ORIGIN ?? "http://localhost:4111";
const stateFile = () => process.env.DEALPATH_OAUTH_FILE ?? join(homedir(), ".config", "mastra-agent-repo", "dealpath-oauth.json");

interface Saved {
  client?: OAuthClientInformationMixed;
  tokens?: OAuthTokens;
  verifier?: string;
}

function load(): Saved {
  try { return JSON.parse(readFileSync(stateFile(), "utf8")); } catch { return {}; }
}

function save(patch: Partial<Saved>) {
  mkdirSync(dirname(stateFile()), { recursive: true });
  writeFileSync(stateFile(), JSON.stringify({ ...load(), ...patch }, null, 2), { mode: 0o600 });
}

let pendingAuthorizationUrl: URL | undefined;

const provider: OAuthClientProvider = {
  get redirectUrl() { return `${APP_ORIGIN}/poc/dealpath/callback`; },
  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: "Deal review sandbox (mastra-agent-repo)",
      redirect_uris: [`${APP_ORIGIN}/poc/dealpath/callback`],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: "mcp:read",
    };
  },
  clientInformation: () => load().client,
  saveClientInformation: (client) => save({ client }),
  tokens: () => load().tokens,
  saveTokens: (tokens) => save({ tokens }),
  redirectToAuthorization: (url) => { pendingAuthorizationUrl = url; },
  saveCodeVerifier: (verifier) => save({ verifier }),
  codeVerifier: () => {
    const verifier = load().verifier;
    if (!verifier) throw new Error("No sign-in in progress. Start again at /poc/dealpath/connect.");
    return verifier;
  },
  invalidateCredentials: (scope) => {
    if (scope === "all") save({ client: undefined, tokens: undefined, verifier: undefined });
    if (scope === "tokens") save({ tokens: undefined });
    if (scope === "verifier") save({ verifier: undefined });
  },
};

// Starts the browser sign-in. Returns where to send the person, or nothing when
// the saved tokens already work.
export async function startSignIn(): Promise<URL | undefined> {
  pendingAuthorizationUrl = undefined;
  const result = await auth(provider, { serverUrl: DEALPATH_MCP_URL, scope: "mcp:read" });
  return result === "REDIRECT" ? pendingAuthorizationUrl : undefined;
}

export async function finishSignIn(code: string): Promise<void> {
  await auth(provider, { serverUrl: DEALPATH_MCP_URL, authorizationCode: code, scope: "mcp:read" });
  client = undefined;
}

export function signOut() {
  save({ tokens: undefined, verifier: undefined });
  client = undefined;
}

export function hasTokens(): boolean {
  return Boolean(load().tokens?.access_token);
}

let client: Client | undefined;

async function connected(): Promise<Client> {
  if (client) return client;
  if (!hasTokens()) throw new DealpathNotConnected();
  const next = new Client({ name: "deal-review-sandbox", version: "0.1.0" });
  try {
    await next.connect(new StreamableHTTPClientTransport(new URL(DEALPATH_MCP_URL), { authProvider: provider }));
  } catch (err) {
    throw /unauthori[sz]ed|401|invalid_token/i.test(String(err)) ? new DealpathNotConnected() : err;
  }
  client = next;
  return client;
}

export class DealpathNotConnected extends Error {
  constructor() { super("Dealpath is not connected. Open /poc/dealpath/connect to sign in."); }
}

// Calls one Dealpath MCP tool and returns its JSON result. A tool error comes
// back as an Error with the server's message.
export async function callDealpath<T = any>(name: string, args: Record<string, unknown>): Promise<T> {
  let result;
  try {
    result = await (await connected()).callTool({ name, arguments: args });
  } catch (err) {
    client = undefined;
    if (err instanceof DealpathNotConnected) throw err;
    if (/unauthori[sz]ed|401|invalid_token/i.test(String(err))) throw new DealpathNotConnected();
    throw err;
  }
  const text = (result.content as { type: string; text?: string }[] | undefined)
    ?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("") ?? "";
  if (result.isError) throw new Error(text || `Dealpath ${name} failed`);
  try { return JSON.parse(text) as T; } catch { return text as T; }
}

export async function dealpathStatus(): Promise<{ connected: boolean; message?: string }> {
  if (!hasTokens()) return { connected: false, message: "Not signed in" };
  try {
    await connected();
    return { connected: true };
  } catch (err) {
    return { connected: false, message: err instanceof Error ? err.message : String(err) };
  }
}
