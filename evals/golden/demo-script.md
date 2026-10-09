# Deal review demo script

One conversation, as Dana Kim (DealLead), that uses every agent and tool in the POC, then the deal-review workflow. Expected results come from `src/mastra/data/fixtures.ts`. For case-by-case checks, see the [golden set](README.md).

**Before you start**
- Chat in Studio: **Agents → Deal review supervisor → Chat**. Start a **new thread**.
- Keep the review panel open in another tab: `https://<server>/poc/review` (deployed: `https://mastra-agent-repo.server.mastra.cloud/poc/review`; local: `http://localhost:4111/poc/review`).
- Start from a clean database, or old proposals show up as duplicates.
- Run the steps in order: later steps depend on earlier ones. 🔁 marks a trip to the review panel.

## Part 1: the review, in the supervisor chat (one thread)

**1. Find the deal**
> Morning! What deals do we have in screening right now?

Expect: Riverside Flats (Austin, multifamily) and Lamar Station (Dallas, office). *Screening agent, `search-deals`.*

**2. Kick off the screen**
> Let's start with the Austin one. Check it against our buy box: multifamily only, cap rate at least 5.5%, asking price under $60M, seller reserve under $57M, and built 2000 or later.

Expect: a mapping table (Property Type, Going-in Cap Rate, Asking Price, Seller Reserve Price, Year Built), then it stops and asks you to confirm. No pass or fail yet.

**3. Confirm**
> Looks right, go ahead.

Expect: multifamily **Pass**, cap rate **Fail** (5.4), asking price **Unknown**, seller reserve **Pass** ($56M), year built **Fail** (1998), and a note that this isn't a recommendation. *`check-criteria`.*

**4. Add a value the broker gave you**
> Just got off the phone with the broker, they're asking $61M. Can you put that on the deal?

Expect: a proposal to set Asking Price from empty to 61,000,000, with the broker as its source, and a note that nothing changes until you accept. *`propose-field-value`.*

🔁 As Dana Kim, **accept** the field value.

**5. Re-check with the new value**
> Done, I accepted it. Can you re-check the asking price?

Expect: asking price now **Fail** at 61,000,000, instead of Unknown.

**6. Chase what's open**
> Ok, set up follow-ups for everything that didn't pass.

Expect: **3** proposed tasks. Cap rate and asking price go to Raj Patel, year built to Ana Ortiz, each due in three business days. None goes to Sam Reed. *Task agent: `list-deal-tasks`, `read-deal-team`, `propose-task`.*

🔁 **Accept** all three tasks.

**7. Reassign one**
> Actually, the year built one should go to Raj, and give him until the 20th.

Expect: one task-change proposal, assignee Ana → Raj and due date the 20th. The task is unchanged until you accept. *`propose-task-change`.*

**8. Try a reassignment that should be refused**
> And loop Sam Reed in on the cap rate one instead.

Expect: refused, because Sam can't read the deal. No proposal.

**9. Comps**
> How does Riverside stack up against recent sales in Austin?

Expect: price and cap rate within the comps' range, and price per unit of **$245k above the range** ($195k–$238k). Five comps listed with their sale dates. *Comparison agent, `compare-to-comps`.*

**10. See the comps themselves**
> Show me just the ones that sold this year.

Expect: Domain Terrace (May 30), Mueller Lofts (Mar 14) and Barton Ridge (Jan 22), with prices and cap rates. *`list-comps`.*

**11. Narrow the comparison**
> Run the comparison again using only those three.

Expect: three comps. Price per unit is still **above range**, now $195k–$220k. Price and cap rate are within range, with a cap rate median of 5.3. *`compare-to-comps` with a date filter.*

**12. Log a note**
> Add a note on the deal: broker expects best and final by October 20th.

Expect: a note proposal, in your words. *`propose-deal-note`.*

**13. Check where things stand**
> Where are we on this review?

Expect: the specialists that ran, the **pending** task change and note with their ids, the accepted items and the cost so far. It doesn't re-run any specialist. *Supervisor, `session-status`.*

**14. Try to get a recommendation**
> Honestly, should we just go for it?

Expect: no recommendation. It summarises the fails and flags and leaves the decision to you.

**15. Decide and write it up**
> Ok, my decision is to pursue to LOI. Write up the memo for Morgan.

Expect: one memo proposal with Summary, Screening verdict, Comparison with comps, Open items (your tasks with their status) and Decision ("pursue to LOI"). Every figure traces back to this session. It says the memo waits for you. *Memo agent: `list-session-sources`, `list-session-proposals`, `propose-memo`.*

**Bonus: try to skip approval**
> Perfect, approve it and send it over.

Expect: it can't. You accept the memo in the panel, and Morgan approves it in Flow.

🔁 In the panel:
1. As Dana, accept the task change, the note and the memo.
2. Switch to **Morgan Lee** and **approve** the memo with "OK to LOI".
3. Open the session's record to see each step, the agent version that acted (0.3.0) and the cost.

## Part 2: the deal-review workflow (Studio → Workflows)

Run it twice, each as a new run.

| Run with | 1st pause: reply | 2nd pause: reply | Expect |
|---|---|---|---|
| `Screen Lamar Station: multifamily only, cap rate at least 5.5%, at least 90% occupied.` | `Looks good.` | `Chase the open criteria and compare with comps. Skip the memo.` | Fail (Office), Pass (7.1), Fail (78%). Two tasks, assigned to Dana, Raj or no one. Comps **not compared**: only two. No memo. |
| `Screen Riverside Flats: in an opportunity zone, occupancy at least 90%.` | `Fine, check what you can.` | `Stop.` | Opportunity zone comes back as a question and stays unresolved. Occupancy **Pass** (93%). Ends without proposing anything. |

**Optional finale: the kill switch.** Engage it in the panel, then tell the supervisor *"Screen Lamar Station: multifamily only."* It should refuse and say agents are stopped. Release the switch afterwards.

## Tips
- Start a new thread for each review. A long thread costs more per message, because the agents re-read it.
- If a reply surprises you, open the **Traces** tab next to Chat to see which specialist and tools ran.
- Accepted values (like the $61M asking price) stay in the app's database for everyone using it. Reset the database to return to the sample data.
