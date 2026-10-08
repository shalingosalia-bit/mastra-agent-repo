# ADR-0040: The acting workspace is chosen at sign-in and fixed for the session

**Status:** Superseded
**Date:** 2026-09-09
**Decides:** Reverses the shipped capability GRO-153 added — a workspace switcher in the shell header.
**Extends:** ADR-0029 (the acting tenant is chosen at sign-in), which decides the same question one level up. Constrained by ADR-0017 (a workspace is a presentation lens, not a permission).

> **Superseded (2026-09-17) by [ADR-0041](ADR-0041-the-workspace-switcher-returns-to-the-chrome.md).** The switcher is back in the chrome, `/choose-workspace` is removed, and `/sign-out` no longer deletes `WORKSPACE_COOKIE`. ADR-0031 separates the workspace from the tenant question this record joined them to: a tenant is whose data a reader is looking at, a workspace is an arrangement of one tenant's own data, and a reader moves between arrangements inside one working session. ADR-0029 continues to govern the tenant. The record below is retained as written. Its body cites `ADR-0029` for the acting tenant, which this change renumbered to [ADR-0039](../../coreservices/authn/ADR-0039-the-acting-tenant-is-chosen-at-sign-in.md); the body stays as written and the number reads through this note.

## Context

The shell header carried a `<select>` listing every workspace the reader was entitled to, and changing it wrote a preference cookie and navigated. It was correct as built: the options came from `resolveWorkspace`'s entitled `switcher` list, so it could not offer a workspace the reader was not assigned to, and `adoptionFor` refused to store a choice the fold had not landed on.

Two things make it the wrong control anyway.

**A workspace decides what a whole session looks like.** It selects the frame (`chrome.mode`), the navigation tree, the focus applied to every grid, and the default view per entity type. A control that changes all of that from the header sits beside the assistant toggle and the user menu, which change nothing. Neuro serves an audience that reads one arrangement of one tenant's records for a working session; being able to swap the arrangement at any moment is an affordance nobody asked for, and it invites the reading that a workspace is somewhere you *go* rather than a lens you are *in*.

**The tenant already answered this question, twice.** ADR-0029 records the two controls that filled the silence about *when* the acting tenant is decided — a header dropdown, then a narrower link — and removes both: chosen once, after authentication, fixed for the session. The workspace sat one level down with the opposite answer, and the two are the same kind of question about the same kind of stored preference. `workspace-switcher.tsx`'s own docstring argued they were different in kind ("switching it mid-session is exactly what it is for"), which is the assertion this decision reverses.

Without a recorded position, the next reader sees the absence of a switcher as a convenience someone forgot and adds it back — the exact loop ADR-0029 exists to end for the tenant.

## Decision

1. **The acting workspace is chosen once, after sign-in, and is fixed for the session.** One entitled workspace resolves silently with no prompt. Several are asked at `/choose-workspace`. None is not a state this reaches — `(shell)/layout.tsx` already answers a reader entitled to no workspace, and a broken tenant, differently.

   The question is asked in **two** places, `(shell)/layout.tsx` and `(shell)/page.tsx`, from one pure function. A layout and the page it wraps render together, and the root page redirects to the resolved home — so with the gate only in the layout, `/` sends a reader with several entitled workspaces to the fold's default without asking, and `/` is the address a sign-in lands on.

2. **The chrome offers no control that changes it, and NAMES it.** The header slot that held the `<select>` now renders the acting workspace's label and icon, beside the entry to the workspace editor. ADR-0029 decision 2 makes this distinction for the tenant and it applies unchanged here: a reader must know which workspace they are in on every page, and telling them is not the same as letting them move. `minimal` continues to draw neither — it names the workspace in its own header instead.

3. **Changing workspace is a sign-out and a sign-in.** `/sign-out` deletes `WORKSPACE_COOKIE` along with `TENANT_COOKIE` and `PREVIEW_COOKIE`, so the next sign-in reaches the chooser rather than replaying the last choice. Without that deletion the reader would be fixed in one workspace with no way to leave it, since the chooser is only reached when nothing has been chosen.

4. **The resolver's precedence is unchanged.** `resolveWorkspace` still prefers the path over the cookie, and every rung below it is untouched. A prefixed URL still wins, still lands where it points, and is never interrupted by the chooser — `workspaceChoicePending` returns false the moment the path names a workspace. Removing the switcher removed an entry point, not a rung of the fold. A path naming a workspace the reader is not entitled to keeps its existing answer: its focus applies, their own workspace supplies the chrome, and no cookie is written.

5. **`WORKSPACE_COOKIE` means "the workspace this reader chose", and remains a preference rather than authority.** Entitlement is re-decided from the assignment rows on every read, so a stored handle the reader has since lost entitlement to stops winning the cookie rung and the fold falls through — exactly as a stale `TENANT_COOKIE` falls back to membership. The reader is then asked again, and the one row the chooser renders is the form POST that repairs the dead preference (`/choose-tenant` does this for the tenant, GRO-666).

6. **A choice is checked against entitlement before it is stored.** `acceptsWorkspaceChoice` refuses a handle outside the reader's entitled set and re-renders the chooser; `adoptionFor` refuses to persist a handle the fold did not land on. The switcher needed neither, because it was rendered from the entitled list and could not offer anything else; a form POST can be edited, so the check that was structural becomes explicit. Neither widens access: a workspace grants nothing either way (ADR-0017), so what these protect is that the app never offers or stores a workspace outside entitlement — not that a stored one could reach data.

7. **A preview pins the workspace and is never interrupted.** An admin who entered a draft did so deliberately; prompting on the first render would offer to leave it. `adoptCookie` is already false under a preview, so nothing a preview does can become the stored choice.

## Alternatives considered

**Keep the switcher and add the sign-in chooser beside it.** Rejected for the reason ADR-0029 rejects keeping the tenant link: a control in the chrome is what a reader takes as the product's position on the question, and two ways to decide one thing means the always-available one sets the meaning.

**Make the switcher available only to a reader entitled to more than two workspaces, or put it behind the user menu.** A narrowing rather than a decision. Each round of narrowing leaves the model unchanged and the next reader free to widen it again, which is the pattern ADR-0029 records for the tenant across two implementations.

**Remove the switcher and name the workspace nowhere.** Rejected: the identity slot names the tenant, so with the switcher gone nothing would name the workspace at all in `wide` or `classic`, and a reader on a focused workspace would see narrowed rows with no statement of which lens produced them. The focus chip names a focus, not a workspace, and only a workspace that declares one has it.

**Prompt on every unprefixed URL rather than only when the app picked.** Rejected: it re-asks a reader who has already chosen and is still entitled, on every visit to `/e/<type>`, for no new information.

## Consequences

Required by this decision:

- **A reader entitled to more than one workspace pays one extra page on the first visit of a session**, and a sign-out and a sign-in to change afterwards. The accepted price, stated rather than discovered — the same one ADR-0029 accepts for a genuinely multi-tenant person.
- **A visit to an unprefixed URL with no stored choice lands on the chooser, not on the destination.** `/e/deal` opened fresh sends a multi-workspace reader to `/choose-workspace`, which redirects to their chosen workspace's home rather than back to `/e/deal`. `/choose-tenant` behaves identically and for the same reason: the choice and the destination are decided by different things.
- **Browser suites that open an unprefixed URL as a fresh session must choose first.** `workspacesSmoke` reaches its first assertion through `/classic`, which is prefixed and therefore unaffected; a suite starting at `/` on the Alpine demo profile — two tenant-assigned workspaces — meets the chooser.
- **`acceptsWorkspaceChoice` is now the only place a reader names a workspace interactively**, so it carries the weight `chooseTenant`'s membership check carries for the tenant. It is split into `features/workspaces/workspace-choice.ts` so it can be reddened, in the shape `auth/tenant-choice.ts` already uses: neither the page nor the action resolves under the test runner.

Unchanged by this decision:

- **No authorization changes.** The switcher was never a gate. `resolveWorkspace` decides entitlement from the assignment rows on every read, and a workspace grants nothing (ADR-0017), so removing the control removes no check and adds no access. The machinery that handles a cookie naming a workspace outside entitlement is not dead and keeps its tests.
- **`ResolvedWorkspace.switcher` keeps its name and its contents.** It is the entitled set, and it is what the chooser lists; what changed is that the chrome no longer draws a control from it. Renaming it would touch the resolver, its tests, and the preview seam to no benefit.
- **The preview seam.** Entering, leaving, and the `previewExit` entry are untouched.

Amendments required elsewhere:

- **`docs/experiences/workspaces/`** describes the chrome's switcher as the way a reader changes workspace. That description is now `/choose-workspace`.

## Traceability

- `apps/dpagentic/src/features/workspaces/workspace-choice.test.ts` executes the entitlement gate — including a handle naming a published workspace this reader holds no assignment to — and every branch of when the chooser appears, including the two that must never interrupt: a prefixed path, and a preview. It also pins the pairing decision 1 describes: both `(shell)/layout.tsx` and `(shell)/page.tsx` ask, and both send the reader to the chooser.
- `apps/dpagentic/src/components/workspace-icon-drawing.test.ts` asserts the chrome names the acting workspace and draws no `<select>`, no switcher component, and no call to `chooseWorkspace`, over comment-stripped source.
- `apps/dpagentic/src/components/admin-entry-pairing.test.ts` follows the binding the editor entry is paired with, which outlived the switcher: the entry sits beside the workspace's name, in one binding, drawn once.
- `apps/dpagentic/tests/artillery/browser.ts` (`workspacesSmoke`) drives the route in a browser: the chooser is reached, a workspace is chosen by its form POST, and the choice is proven on an unprefixed URL — which is where a preference that was never written would show up as the fold's default instead.
