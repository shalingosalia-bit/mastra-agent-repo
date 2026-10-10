# Loom script: the deal review agents

A seven-minute recording showing the agents working on a deal (in the deal review app) next to how they're built (in Mastra Studio). It covers a representative subset of scenarios, not every one. For the full walkthrough, see the [demo script](demo-script.md).

## Before you record

1. **API key.** In the repo, run `cp .env.example .env` and set `ANTHROPIC_API_KEY=` to your key.
2. **Start fresh.** Stop the dev server, delete `mastra.db`, then run `npm run dev`. Old proposals and threads would otherwise clutter the panels.
3. **Two windows side by side:**
   - **Left, the app:** http://localhost:4111/poc/app, acting as **Dana Kim · DealLead**. Click **+ New review**.
   - **Right, Studio:** http://localhost:4111, on **Agents**.
4. **Dry run.** Send one message in the app and check that a reply arrives. Then delete `mastra.db` again and restart.
5. **Agents take 10–40 seconds per turn.** Keep talking over the wait, or trim the pauses in Loom afterwards.

## The script

| # | Time | Do this | Say this |
|---|---|---|---|
| 1 | 0:00 | **Studio → Agents.** Hover over the five rows, then open **Deal review supervisor** and point at **Config**: Agents 4, Tools 1. | "One supervisor and four specialists, built in Mastra. Screening, comparison, tasks and the memo. The supervisor never answers deal questions itself. It routes each request to a specialist." |
| 2 | 0:40 | **App.** Send: *"Morning! Screen Riverside Flats for me: multifamily only, cap rate at least 5.5%, asking price under $60M, and seller reserve under $57M."* | "I'll ask in plain English, the way a deal lead would." |
| 3 | 1:10 | Reply arrives: a **mapping** table and a question. Point at **What the agents did**: a handoff to screening, `find-deal`, `describe-deal-fields`. **Studio:** open the supervisor's **Traces** and click the latest run. | "It hasn't checked anything yet. It shows how it read each criterion and waits for me to confirm. On the right you can see the handoff to the screening agent and the tools it used." |
| 4 | 1:40 | **App.** Send: *"Looks right, go ahead."* | — |
| 5 | 2:05 | Verdict: Pass / **Fail 5.4** / **Unknown** / Pass $56M. | "Every value comes from a field on the deal. The asking price isn't on the deal, so it says Unknown rather than guessing. And there's no recommendation. That's on purpose." |
| 6 | 2:30 | **App.** Send: *"The broker just told me they're asking $61M. Put that on the deal."* A **Field value** card appears under **Waiting for you**. | "Agents never write directly. This is a proposal, and the deal doesn't change until I accept." |
| 7 | 2:55 | Click **Accept** on the **Field value** card. The card leaves **Waiting for you**. No agent runs; accepting only saves the value on the deal. | "I accept it. Now the asking price is on the deal, with the broker as its source." |
| 8 | 3:05 | **App.** Send: *"Done. Re-check the asking price."* Result: **Fail** at $61M. Point at **What the agents did**: supervisor → screening specialist → `check-criteria`. | "Screening reads the value I just accepted. $61M is over the $60M limit, so it fails." |
| 9 | 3:25 | **App.** Send: *"Honestly, should we just go for it? And move the deal to LOI while you're at it."* | "Let's see if I can get it to overstep." |
| 10 | 3:50 | Reply: no recommendation, and it can't change the stage. | "No recommendation, and no stage changes. Only people make those calls." |
| 11 | 4:05 | **App.** Send: *"How does Riverside compare with Austin sales since January?"* Result: three comps, price per unit **above range**. **Studio Traces:** comparison agent → `compare-to-comps` with a date filter. | "The comparison agent filters to this year's sales. The maths happens in code, not in the model, and it refuses outright with fewer than three comps." |
| 12 | 4:45 | **App.** Send: *"My decision is to pursue to LOI. Write up the memo for Morgan."* A **Memo** card appears. Click to read it, then **Accept**. | "The memo quotes only figures this review actually sourced. The tool rejects anything else." |
| 13 | 5:20 | Switch **Acting as** to **Morgan Lee · Approver**. Under **Memos to approve**, click **Approve** and type "OK to LOI". Switch back to Dana. | "The approver decides, never an agent. The deal records who decided and on what evidence." |
| 14 | 5:45 | **Studio → Workflows → deal-review.** Show the graph and point at the two forks. **Run** with: *"Screen Lamar Station: multifamily only, cap rate at least 5.5%."* | "The same review also runs as a workflow, where the engine enforces each pause. It has two decisions: is the deal outside the buy box, and is any data missing?" |
| 15 | 6:10 | Resume `confirm-mapping` with *"Looks good."* It pauses at **buy-box-gate**: *"Lamar Station is outside your buy box: Property Type is Office. Continue?"* Resume with *"No, stop here."* | "It's an office building, so the workflow asks before going on. I'll stop here." |
| 16 | 6:35 | The graph shows the path taken. **App:** a **Note** card ("Screened out: outside the buy box") is under **Waiting for you**. | "Even stopping is a proposal I accept." |
| 17 | 6:50 | **App.** Point at **What the agents did** and the session cost line. | "Every turn is recorded: which agent and version acted, which tools ran, and what it cost. That's the foundation every Dealpath agent will run on." |

## If something goes wrong on camera

- **"Could not find API key"** in the chat: the `.env` key is missing. Fix it and restart `npm run dev`.
- **A reply says it reached its cost bound:** start a **+ New review** and continue there.
- **Duplicate or old cards on the right:** stop the server, delete `mastra.db`, restart.
- **A different wording than the script:** that's fine. Check the values against the expected results: cap rate 5.4, seller reserve $56M, price per unit $245k above the comps' range.
