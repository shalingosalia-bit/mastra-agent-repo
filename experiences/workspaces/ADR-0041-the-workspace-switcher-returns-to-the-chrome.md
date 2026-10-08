# ADR-0041: The workspace switcher returns to the chrome

**Status:** Accepted
**Date:** 2026-09-17
**Supersedes:** ADR-0040 in full. The capability GRO-153 added, and ADR-0040 removed, is restored.
**Constrained by:** ADR-0017 (a workspace is a presentation lens, not a permission).

> **Amendment (2026-09-25):** [ADR-0037](../../coreservices/authn/ADR-0037-identity-and-access.md) supersedes ADR-0039. The acting tenant is still fixed for the session, and it is now chosen at sign-in by the credential (ADR-0037 §How a sign-in reaches its tenant), and not at `/choose-tenant` as the ADR-0039 item under Unchanged by this decision says. The workspace decisions below are unaffected. The record below is retained as written.

## Context

ADR-0040 moved the acting workspace out of the chrome. A reader entitled to more than one workspace was asked at `/choose-workspace` after sign-in, the answer was stored, and changing it meant signing out and signing in again. The header slot that had held a `<select>` rendered the workspace's name.

That decision read the workspace as the same kind of question as the tenant, which ADR-0039 settles by asking once at sign-in. The two are not the same kind of question. A tenant is whose data a reader is looking at, and a reader who moves between two customers' data in one sitting is rare. A workspace is an arrangement of one tenant's own data, and a reader who works across two arrangements in one sitting is ordinary: a deal lead in two teams reads one team's pipeline, then the other's, inside one working session. ADR-0017 already records the separation that makes this safe, since a workspace narrows what is offered and grants nothing.

The chooser also charges the cost at the wrong moment. A reader arriving at `/e/deal` from a link meets a page asking which workspace to act in, and answering it redirects them to that workspace's home instead of the record they opened. Changing arrangement afterwards costs a sign-out and a sign-in, where it once cost one click.

## Decision

1. **The acting workspace is chosen from the chrome, at any point in a session.** `WorkspaceSwitcher` is a `<select>` over the reader's entitled workspaces, calling the `chooseWorkspace` server action, which writes the preference and redirects to the chosen workspace's home. `/choose-workspace` is removed, along with the gate in `(shell)/layout.tsx` and `(shell)/page.tsx` that sent a reader to it.

2. **One control both names the acting workspace and changes it.** In `wide` and `classic` the switcher states which workspace the reader is in: the acting entry's label, its icon, and `data-workspace` holding the handle. A reader entitled to exactly one workspace gets the name and no control, because a select with a single option invites a click that does nothing. `minimal` continues to draw neither the switcher nor the workspace-editor entry, and names the workspace in its own header.

3. **`/sign-out` deletes the tenant and preview cookies, and leaves `WORKSPACE_COOKIE`.** ADR-0040 decision 3 deleted it because the chooser was the only route out of a stored choice. The switcher is that route again, so a reader is never held in a workspace. `WORKSPACE_COOKIE` returns to `workspace.server.ts`, where the rest of the resolver's cookie handling lives.

4. **The resolver's precedence is unchanged.** `resolveWorkspace` still prefers the path over the cookie, and every rung below it is untouched. A prefixed URL still wins and still opens what it points at. A path naming a workspace the reader is not entitled to keeps its existing answer: its focus applies, their own workspace supplies the chrome, and no cookie is written.

5. **The entitled list is the only thing the control is built from.** `resolveWorkspace` decides entitlement from the assignment rows on every read and puts the result in `switcher`; the component receives that list whole and can offer nothing outside it. `adoptionFor` is the second check and declines to persist a handle the fold did not reach.

6. **A preview pins the workspace.** `adoptCookie` is already false under a preview, so entering a draft stores nothing.

## Alternatives considered

**Keep both the chooser and the switcher.** Two surfaces deciding one thing, where the always-available one sets the meaning. The chooser then asks a question the header answers on every page afterwards.

**Keep the chooser and reach it from the user menu.** The cost of changing workspace stays a full page and a redirect to a home the reader did not ask for, and the control that changes the session is placed in a menu whose other entries change nothing.

**Offer the switcher only to a reader entitled to more than two workspaces.** A threshold with no principle behind it. A reader with two workspaces moves between them as often as a reader with five.

## Consequences

Required by this decision:

- **A reader entitled to more than one workspace changes the session's arrangement from any `wide` or `classic` page.** `minimal` draws no switcher, so a reader on one of those pages leaves the frame first. The stored preference follows, so an unprefixed URL opened later resolves to the same workspace.
- **A stored handle the reader has since lost entitlement to falls through the fold**, as it did before ADR-0040, and the reader opens whichever workspace their assignments resolve. No form repairs the dead preference, because the switcher writes a new one on the next change.
- **`WORKSPACE_COOKIE` outlives a sign-out**, alongside the browser's other retained state and unlike the tenant and preview cookies, which `/sign-out` still deletes. The next person signing in on that browser starts in the last workspace chosen on it, and one change of the switcher moves them.
- **The browser suites drive the control again.** `workspacesSmoke` reads the entitled options off the `<select>`, switches to `classic`, and asserts the stored preference on an unprefixed URL. The helpers that answered the chooser on behalf of a header-authenticated suite are removed, since no suite meets one.

Unchanged by this decision:

- **No authorization changes.** The switcher was never a gate, and restoring it adds no access. A workspace grants nothing (ADR-0017), and entitlement is re-decided from the assignment rows on every read.
- **`ResolvedWorkspace.switcher` keeps its name and its contents.** It is the entitled set, and the control is drawn from it.
- **The preview seam.** Entering, leaving, and the `previewExit` entry are untouched.
- **ADR-0039.** The acting tenant is still chosen once, after authentication, at `/choose-tenant`. This decision separates the two questions, and reverses nothing about the tenant.

Amendments required elsewhere:

- **`docs/experiences/workspaces/03-requirements-and-user-stories.md`** describes the workspace as chosen at sign-in. That description is the chrome's switcher again.
- **`testcases/workspace-chrome.md`** asserts the classic frame draws no `select[aria-label="Workspace"]`. It asserts one.

## Traceability

- `apps/dpagentic/src/components/workspace-icon-drawing.test.ts` asserts, over the chrome's source, that the switcher is drawn and given the entitled list whole, and over the switcher's own source that the acting entry is found by handle and never taken off the front of the list.
- `apps/dpagentic/src/components/admin-entry-pairing.test.ts` follows the binding the workspace-editor entry shares with the switcher: one binding, drawn once, so no frame can offer one without the other.
- `apps/dpagentic/tests/artillery/browser.ts` (`workspacesSmoke`) drives the control in a browser: the entitled options are read off the `<select>`, `classic` is selected, and the choice is asserted on an unprefixed URL, where a preference that was never written would appear as the fold's default.
