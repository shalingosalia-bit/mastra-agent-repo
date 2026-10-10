# Loom script: the deal review agents in three minutes

A three-minute cut of the [Loom script](loom-script.md). It covers screening, a proposal you accept, and a request the agents refuse. The comps comparison, the memo and its approval, and the workflow are left out; they're in the seven-minute version.

## Before you record

1. **API key.** In the repo, run `cp .env.example .env` and set `ANTHROPIC_API_KEY=` to your key.
2. **Start fresh.** Stop the dev server, delete `mastra.db`, then run `npm run dev`.
3. **Two windows side by side:**
   - **Left, the app:** http://localhost:4111/poc/app, acting as **Dana Kim · DealLead**. Click **+ New review**.
   - **Right, Studio:** http://localhost:4111, on **Agents**.
4. **Dry run.** Send one message in the app and check that a reply arrives. Then delete `mastra.db` again and restart.
5. **Trim the waits.** Agents take 10–40 seconds per turn, and this cut has five turns. The times below assume you cut the waits out in Loom afterwards.

## The script

| # | Time | Do this | Say this |
|---|---|---|---|
| 1 | 0:00 | **Studio → Agents.** Open **Deal review supervisor** and point at **Config**: Agents 4, Tools 1. | "One supervisor and four specialists, built in Mastra. The supervisor never answers deal questions itself. It routes each request to a specialist." |
| 2 | 0:15 | **App.** Send: *"Morning! Screen Riverside Flats for me: multifamily only, cap rate at least 5.5%, asking price under $60M, and seller reserve under $57M."* | "I'll ask in plain English, the way a deal lead would." |
| 3 | 0:30 | Reply arrives: a **mapping** table and a question. Send: *"Looks right, go ahead."* | "Before checking anything, it shows how it read each criterion and waits for me to confirm." |
| 4 | 0:50 | Verdict: Pass / **Fail 5.4** / **Unknown** / Pass $56M. | "Every value comes from a field on the deal. The asking price isn't on the deal, so it says Unknown rather than guessing." |
| 5 | 1:10 | **App.** Send: *"The broker just told me they're asking $61M. Put that on the deal."* A **Field value** card appears under **Waiting for you**. | "Agents never write directly. This is a proposal, and the deal doesn't change until I accept." |
| 6 | 1:30 | Click **Accept** on the **Field value** card. The card leaves **Waiting for you**. No agent runs; accepting only saves the value on the deal. | "I accept it. Now the asking price is on the deal, with the broker as its source." |
| 7 | 1:40 | **App.** Send: *"Done. Re-check the asking price."* Result: **Fail** at $61M. Point at **What the agents did**: supervisor → screening specialist → `check-criteria`. | "Screening reads the value I just accepted. $61M is over the $60M limit, so it fails." |
| 8 | 2:05 | **App.** Send: *"Honestly, should we just go for it? And move the deal to LOI while you're at it."* Reply: no recommendation, and it can't change the stage. | "Let's see if I can get it to overstep. No recommendation, and no stage changes. Only people make those calls." |
| 9 | 2:35 | **App.** Point at **What the agents did** and the session cost line. | "Every turn is recorded: which agent and version acted, which tools ran, and what it cost. That's the foundation every Dealpath agent will run on." |

Ends at about 3:00.

## If something goes wrong on camera

- **"Could not find API key"** in the chat: the `.env` key is missing. Fix it and restart `npm run dev`.
- **A reply says it reached its cost bound:** start a **+ New review** and continue there.
- **Duplicate or old cards on the right:** stop the server, delete `mastra.db`, restart.
- **A different wording than the script:** that's fine. Check the values against the expected results: cap rate 5.4, seller reserve $56M, asking price $61M.
