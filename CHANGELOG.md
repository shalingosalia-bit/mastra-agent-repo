# Changelog

What changed in the sandbox, newest first. Card numbers are GRO: Deal Screening.

## 2026-10-16: prototype demo

- **Proposals in the conversation.** A turn's new proposals show under the agent's reply, with a link to review them, as they would in Claude. Nothing is accepted from the chat (agentic FR51).
- **Inspector.** The side panel is labelled as a stand-in for what a headless DealLead sees elsewhere: the buy box (card #29), proposals to accept (card #24), and each turn's handoffs and tools.
- **Sample deals first.** Attach OM and Connect Dealpath are marked optional. The demo runs on Riverside Flats and Lamar Station with no sign-in, and the starter prompt that needed a Dealpath deal now records a broker-stated asking price instead.
- **Shelved:** per-person Dealpath sign-in from Claude through the deal-review MCP server (card #23), on branch `dealpath-oauth-mcp`. It works up to Dealpath's sign-in page; the end-to-end sign-in from Claude Code was not completed.

## Earlier

- Serve the deal review agent to Claude over MCP (card #23).
- Read Dealpath deals, keep a saved buy box, and read attached OMs.
- Loom script for demoing the agents.
- Yes/no decisions on the buy box and missing data.
- Deal review app for testing the agents locally.
