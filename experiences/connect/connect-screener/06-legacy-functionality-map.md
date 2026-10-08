# Legacy functionality map

Every component, helper and model in sunspear's Connect surface, with a disposition. **Subsumed** means the behaviour survives inside a component or mechanism named in the row. **Ported** means it moves substantially as written. **Deleted** means nothing carries it. **Moves** means another stack owns it. **Splits** means the container half and the presentational half go to different places, which is the common outcome here and the reason this map exists.

The claim of [`00-connect-screener.md`](00-connect-screener.md) is that the whole surface renders with no database. The `Splits` rows are where legacy cannot meet it: each one names the fetching that has to leave the component before the rest of it can be a story.

## Screens and containers

| Legacy | Disposition |
|---|---|
| `connectListingsDashboard.tsx` | **Splits.** The rendering becomes `ArrivalQueue` plus the filter bar and decision bar; the view resolve-or-create, the bidirectional cursors, the per-direction loading flags, the initialisation flag and the loop guard become the container's in `apps/dpagentic`. The loop guard does not survive at all — it exists because fetch orchestration sits inside a rendering component (defect class 1) |
| `ConnectListingStatusFeed/ConnectListingStatusFeedContainer.tsx` | **Splits.** Rendering becomes `OfferingTimeline`; the feed fetch and the two hydration round trips it makes for dispositions and users become one container read. The hydration exists because the service returns ids and a formatted label, so it disappears with defect class 3 rather than moving |
| `ConnectListingStatusFeed/ConnectListingStatusFeed.tsx`, `ConnectListingStatusFeedListView.tsx`, `ConnectListingStatusFeedListViewRow.tsx` | **Subsumed** → `OfferingTimeline` and its registered row renderers. Three components for a list, its view and its row become one component with a row-renderer registry (CS15) |
| `ConnectListingStatusFeed/ConnectActivityFlyout.tsx` | **Subsumed** → the detail screen's timeline panel |
| `ConnectListingStatusFeed/ConnectDpListingStatus.tsx`, `ConnectForwardedEvent.tsx` | **Ported** → two registered row renderers, one per `TimelineEntryKind` member |
| `ConnectListingStatusFeed/ConnectFeedHelpers.tsx` | **Deleted.** Day grouping and label formatting move into `OfferingTimeline` from instants (CS7); nothing carries a helper that reshapes a server's pre-grouped payload |
| `ConnectListingFlyout/BaseConnectListingFlyout.tsx`, `SingleConnectListingFlyout.tsx`, `MultiConnectListingFlyout.tsx` | **Subsumed** → one detail component with a selection prop. Three variants for one screen are the variant explosion [`experiences/views/01-legacy-pitfalls.md`](../../views/01-legacy-pitfalls.md) names; what is specific here is that "one offering or several" is a prop, not a component |
| `ConnectListingFlyout/ListingFlyoutRoute.test.tsx` | **Moves** → the app's routing tests. A route is not a presentational concern |
| `ConnectListingContext.tsx` | **Deleted.** A context carrying domain data through the surface is the second copy of the domain [`02-best-practice-research.md`](02-best-practice-research.md) rules out; the data arrives as props |

## Cards and layout

| Legacy | Disposition |
|---|---|
| `ConnectCard.tsx`, `connectListingTile.tsx`, `connectListingTileHeader.tsx`, `TileBodySectionInfo.tsx` | **Subsumed** → `OfferingCard` with its header, body and badge slots. Four components for one card is a consequence of the body being assembled from a constant table rather than from field metadata |
| `helpers.tsx` — the per-attribute field-value constants, their `SUM` and `MIN_MAX_RANGE` aggregation variants and their `DEFAULT_VALUE_*` twins | **Deleted.** The field's own metadata carries the label, unit, precision and declared aggregation (CS5, CS6). This table is the frontend half of essos' column-per-attribute, and it is the single largest piece of this surface that the entity-type decision removes |
| `helpers.tsx` — `getPropertyType`, `getPropertyTypeDisplayString` | **Subsumed** → the field's select-option labels. A display string derived in code from two columns is what a select field's labels are for |
| `ConnectAttributes.tsx`, `ConnectPill.tsx`, `ConnectPillContainer.tsx` | **Subsumed** → the shared badge and attribute renderers in [`ui/`](../../../../packages/shared/ui), with the pill's meaning coming from field metadata |
| `ConnectPhotoCarousel.tsx`, `ConnectCarouselArrow.tsx`, `ConnectWidgetCarousel.tsx` | **Moves** → the shared gallery and carousel components. A carousel is not a Connect concept |
| `ConnectListingBody.tsx`, `ConnectListingHighlights.tsx` | **Subsumed** → the card body's field rendering and a repeating field's renderer |

## Panels

| Legacy | Disposition |
|---|---|
| `InfoViewWidgets/ContactsWidget/ConnectContactsWidget.tsx` | **Deleted** as a wrapper → `ContactsWidget` over the existing `BaseContactCard` and `BaseContactsWidgetCardView`, configured for this type (CS17) |
| `InfoViewWidgets/PhotosWidget/ConnectPhotosWidget.tsx` | **Deleted** as a wrapper → `BasePhotosWidget`, which already exists, over [`documents/`](../../../coreservices/documents/00-documents.md) |
| `InfoViewWidgets/StreetViewWidget/ConnectStreetViewWidget.tsx` | **Deleted** as a wrapper → `BaseStreetViewWidget`, which already exists, reading the record's address fields |
| `InfoViewWidgets/PropertyLocationWidget/ConnectPropertyLocationWidget.tsx` | **Generalised**, not deleted. This directory holds no base component, so the location panel exists only in its Connect form and has to be made type-agnostic before it can be shared (CS17) |
| `InfoViewWidgets/EsriWidget/ConnectEsriWidget.tsx` | **Deleted** as a wrapper → `BaseEsriWidget`, which already exists, reading derived values, which is where the enrichment lands (`experiences/connect/06-legacy-functionality-map.md`) |
| `ConnectAiWidgets/AiWidgetTable.tsx` and its siblings | **Subsumed** → the proposed-values review panel. An AI panel whose shape is a `widget_type` discriminator on a JSON column becomes a review of proposals against fields, which is a shared surface rather than a Connect one |

## Affordances and writes

| Legacy | Disposition |
|---|---|
| `ConnectListingStatusActions.tsx` | **Splits.** The rendering becomes `DecisionBar` with its four write states and an undo window (CS9, CS10); the write itself becomes the container's call to one of two operations — the publication disposition before adoption, the status-field write after (`syndication/`, R11) |
| `ConnectPassListingModal.tsx` | **Subsumed** → the decision flow's reason prompt. The reason becomes a field value rather than a column on a flags table |
| `LinkListingToDealModal.tsx` | **Subsumed** → the promote flow, whose idempotency is the provenance edge's uniqueness (CN13) rather than a modal that must not be submitted twice |
| `ConnectObjectSelectNavigator.tsx` | **Subsumed** → the queue's selection model and its keyboard navigation (CS11, CS12) |
| `ConnectTopBarMenu.tsx`, `ConnectViewActionsMenu.tsx`, `ConnectViewSelectorCombobox.tsx` | **Moves** → [`views/`](../../views/00-views.md). A view selector and its actions are the view engine's, and a Connect-specific one is why the screener's saved views are not views (CS21) |
| `ConnectListingSearch.tsx` | **Moves** → the shared filter bar over [`search/`](../../../coreservices/search/00-search.md) |
| `connectListingsDashboard.test.tsx`, `BaseConnectListingFlyout.test.tsx`, `MultiConnectListingFlyout.test.tsx`, `ConnectListingStatusActions.test.tsx` | **Ported** as the behavioural half; the rendering assertions become stories (CS2). A test that needs a live API to reach a state is what the split removes |

## Models and connectors

| Legacy | Disposition |
|---|---|
| `app/models/connect_listing.ts` | **Deleted.** A client-side model class for a domain with its own schema; the record and its field metadata replace it |
| `app/connectors/listings.ts` | **Moves** → the container's calls to [`connect/`](../00-connect.md) and the record reads. A connector module is the container's dependency, never a component's |
| The `is_ai_enhanced` flag the service computes per listing, and the seconds-versus-milliseconds timestamps the client compensates for | **Deleted.** The first is a presentation flag computed in a serializer; the second is defect class 3 of [`experiences/connect/01-legacy-pitfalls.md`](../01-legacy-pitfalls.md) seen from the client, and one timestamp representation removes the compensation (CN15) |

## Capabilities legacy does not have

These are the blank cells in [`03-requirements-and-user-stories.md`](03-requirements-and-user-stories.md)'s `Legacy today` column. They are new work, not a port.

1. **A surface that renders without an API** (CS1, CS2). No component in the legacy surface can be driven from a fixture, so no state of it has ever been reviewed in isolation.
2. **Absence distinguished from emptiness** (CS3, CS4). Both arrive as an empty array today, so a misconfigured filter and an empty queue are the same rendering.
3. **A rendered write state** (CS9). A decision in flight, and a decision that failed, have no appearance.
4. **A withdrawable disposition and an undo window** (CS10). The service cannot express a withdrawal (CN12), so the surface has never needed to render one.
5. **A persistent selection and keyboard navigation** (CS11, CS12, CS13). The surface is pointer-driven, and losing one's place is the path that produced a duplicate attribution.
6. **Announced arrivals** (CS14). New items in an open list are not announced, and nothing protects the selection.
7. **A rendered resolution** (CS16). There is no resolution to render, because legacy records none (CN6).
8. **Virtualisation and a stated rendering budget** (CS19). The queue renders in full.
9. **A token audit** (CS20). Whether components carry literal colours and spacings has not been established, so the surface's behaviour under a theme change is unknown rather than known-good.
