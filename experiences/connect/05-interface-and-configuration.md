# Interface and configuration points

Connect exports nothing, because Connect is not a package ([ADR-0029](ADR-0029-connect-capability-boundary-and-listings-repository.md)). Its interface is the configuration a tenant and an operator supply to the stacks it binds, and its correctness is checkable by reading those rows.

## Configuration by owning stack

| What is configured | Where it lives | Who sets it |
|---|---|---|
| The `listing` and `listing_criterion` entity types, their fields, and their standard bindings | Entity-type configuration, provisioned as a blueprint | Provisioning; a tenant admin extends it |
| Views over listings — the pipeline list, the detail layout, the screening dashboard | View definitions ([`views/`](../views/00-views.md)) | Provisioning; a tenant admin authors more |
| The Connect Buy-Side workspace — navigation, home, chrome, focus | A workspace row ([`experiences/workspaces/04-proposed-model.md`](../workspaces/04-proposed-model.md)) | Provisioning; a tenant forks to author its own |
| A source: its kind, its schedule, its credential reference, its source map | An `ingest_sources` row ([`coredata/ingest/04-proposed-model.md`](../../coredata/ingest/04-proposed-model.md)) | Priya, through the source-connection flow |
| A live connection: its subscription, its cursor, its grant, its health | The acquisition front for that method, joined to the source by its id | Set by the front, read by Priya and Ops |
| How an arrival maps onto listing fields | A `source_maps` row | Priya; shared as a tenant record like any other |
| Which fields of a listing travel, and to whom | A publication's disclosure set and audience rule ([`coreservices/syndication/04-proposed-model.md`](../../coreservices/syndication/04-proposed-model.md)) | Marcus, per publication |
| A named audience's membership | An audience record | The platform, or a publisher curating its own |
| The buy box a repository query is filtered by | `listing_criterion` records | Dana |

## Operator-tunable settings

Every key is under `connect.` or the owning stack's prefix, in [`packages/shared/settings`](../../../packages/shared/settings) per [CLAUDE.md](../../../CLAUDE.md) §Code quality principles. The legacy value of each is a code constant: defect class 11 in [`01-legacy-pitfalls.md`](01-legacy-pitfalls.md).

| Key | What it changes for the user | Default | Owning stack | Degenerate value |
|---|---|---|---|---|
| `ingest.resolution.autoMergeThreshold` | How confident the system has to be before it folds an arriving offering into a listing already on file without asking. Higher means more duplicates to reconcile by hand; lower means more wrong merges to undo | `0.92` | `ingest/` | At or below the proposal threshold, so every match merges silently and the proposal band vanishes |
| `ingest.resolution.proposalThreshold` | How weak a resemblance still deserves a human look. Below it, an arrival becomes a new listing with no question asked | `0.70` | `ingest/` | Zero, so every arrival becomes a proposal and nothing lands unattended |
| `ingest.resolution.comparatorWeights` | Which attributes count most when deciding two offerings are the same building — the street line, the submarket, the broker's own identifier, the price | per-source, no platform default | `ingest/` | All zero, so every score is zero and every arrival creates |
| `ingest.dedup.window` | How long after a broker email arrives a re-send of the same message is recognised as the same message rather than becoming a second card | `30d` | `ingest/` | Zero, so a forwarded email re-sent a minute later produces a duplicate |
| `ingest.email.forwardCap`, `ingest.email.forwardCapPeriod` | How many deals one person can forward in before the door starts bouncing them, which is what stops a misconfigured auto-forward rule from flooding the queue | `500` per `1h` | `ingest/` | A cap of zero, so the door bounces everything, including the first legitimate forward |
| `connect.mailbox.renewalWindow` | How far ahead of a mailbox connection's expiry we renew it. Too short and a slow renewal means missed mail; too long and we renew far more often than needed | `24h` | mailbox front | Longer than the provider's maximum subscription life, so renewal never fires and the connection lapses |
| `connect.mailbox.retryCeiling`, `connect.mailbox.retryBackoff` | How hard we try a mail provider that is refusing or timing out before we stop and report the connection unhealthy | `5` attempts, exponential from `2s` | mailbox front | A ceiling of zero, so one transient provider error marks a healthy connection broken |
| `connect.mailbox.backfillWindow` | How far back we read a folder when a mailbox is first connected | `30d` | mailbox front | Unbounded, so connecting a long-lived mailbox ingests years of mail as new deal flow |
| `connect.mailbox.previewBatchSize`, `connect.mailbox.previewTargetCount` | How many messages the setup preview reads, and how many results it tries to show before stopping | `25` per batch, `3` results | mailbox front | A target above the batch size with no top-up, so preview returns fewer results than it promises |
| `ingest.reconcile.interval`, `ingest.reconcile.strandedMargin` | How quickly an arrival that the push path dropped gets picked up anyway. The point at which an arrival counts as stranded is the source's retry chain plus this margin, never set directly | `15m`, margin `10m` | acquisition front | A margin of zero or less, which puts the stranded point at or before the end of the retry chain, so an arrival still legitimately retrying is re-driven alongside itself |
| `ingest.payload.retentionCeiling` | How long a raw forwarded email is kept so Ops can re-drive it, after which it is erased | `14d` | `ingest/` | Longer than the tenant's declared retention, which the retention declaration refuses |
| `syndication.repository.maxPageSize` | The largest page a repository browse will return, which bounds what one query costs when a broad audience rule matches a great deal | `200` | `syndication/` | Unbounded, which is the unbounded-read defect the timeline requirement exists to prevent |
| `connect.web.fetchPolicy` | Whether we follow a link a broker put in an email, and what we refuse to fetch — anything not publicly routable, at every redirect hop | deny private and link-local ranges, follow at most `3` hops | web acquisition front | Permissive, which is the request-forgery hole CN19 exists to close |

Defaults are the platform's starting values, not limits. Every key is settable per environment, and the ones a tenant may reasonably need to differ on are tenant-scoped.

One value has no configurable form: the point at which an arrival counts as stranded is derived as the source adapter's retry chain plus the stranded margin. Exposing the total as its own setting is how the two drift.

## Instantiation-time choices

| Choice | What it changes for the user | Where it is fixed |
|---|---|---|
| `listingTypeHandle` | Which kind of record an inbound offering becomes, and therefore which fields, views, filters and flows apply to it | The provisioning blueprint. A handle no entity type uses means arrivals resolve against nothing and every one creates a record |
| The registered source kinds, and the front behind each | Which ways deal flow can reach the product in this deployment. A kind with no registered front, or a front with no adapter behind it, cannot be offered to a tenant at all | The ingest pipeline's adapter registry, and the host's composition of fronts |
| The comparator registry | Which attributes are available to score a match on. A comparator not registered cannot be weighted, whatever a setting says | The ingest pipeline's comparator registry, versioned so a derivation change is a deliberate rebuild |
| The repository's identity | Which platform-plane repository listings are published into. The model does not assume exactly one | Syndication's repository configuration |

## What has no configuration point

1. **Who may read a record.** Access plans decide ([`authz/`](../../coreservices/authz/00-authorization.md)). An audience rule says who may discover a publication. That is a different question.
2. **What a workspace allows.** A workspace changes what a person is offered (ADR-0017). There is no setting that makes it grant anything.
3. **Which environment a rule applies in.** Behaviour that differs per environment is a setting whose value differs per environment, verifiable by grepping for the environment accessor.
