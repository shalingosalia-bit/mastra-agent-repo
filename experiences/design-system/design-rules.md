# Design-system rules

Read this before writing a component or a call site. It is the design system's rules and its component menu in one file, so an agent has both without running the Storybook.

Where the Storybook dev server is running, `http://localhost:6006/mcp` is the authority on a component's props and states — it reads the real types. This file is the fallback and the menu. The two are allowed to differ in depth, never in substance.

To see a component drawn, https://dealpath-design-system.vercel.app has the Storybook `develop` publishes. Vercel Authentication guards it: a person signs in with a Dealpath Vercel account, and an agent reads it with `vercel curl <url> --scope dealpath`, which bypasses the protection on its own.

## The import rule

`@neuro/ui` is the only specifier. It re-exports `@dealpath/ui-components` — Dealpath's design system, nicknamed Bolide, published by the DES team — plus Neuro's own additions.

1. Import from `@neuro/ui`. Never from `@dealpath/ui-components`.
2. If the library has it, do not hand-write it. This covers a whole composition as well as a single control: a `Card`, a `Widget` and a `Dialog` are each assembled from slots `@neuro/ui` exports. Check the menu below before creating a component.
3. A Neuro-only component belongs in `@neuro/ui` beside the re-export, not in an app. `03-ownership-and-contribution.md` gives the rule that decides which side something lands on.

## Rules, and what catches each one

Each rule below is a correction you can check your own output against. The right-hand column names the check that fails when the rule is broken, or says the rule is unenforced — an unenforced rule is still a rule, and it is the input to a future check rather than something to leave out.

| Rule | Broken by | Caught by |
| --- | --- | --- |
| Do not hand-write a control the library provides, in any of these eight families: `RadioGroup`, `Switch`, `Separator`, `Breadcrumb`, `Avatar`, `Tabs`, `Spinner`, `Kbd` | `<div role="tablist">`, `<hr />`, `<input type="radio" />`, `<img className="rounded-full" />` | `bun run lint:design-system` (`scripts/design-system-check.ts`). Each keys on the element or the accessibility contract the library's own component emits, and names the component to import |
| Do not hand-write a form group, a disclosure, a checkbox or an alert: use `FieldSet`, `Accordion`, `Checkbox` and `Alert` | `<fieldset>`, `<details>`, `<input type="checkbox" />`, `<div role="alert">` | `bun run lint:design-system` (`scripts/design-system-check.ts`). `FieldSet` renders the `fieldset`, not `Field`. `role="status"` is a live region and is left alone |
| A rule reads source and not the prose about it | explaining a `<details>` in the doc block above it | `bun run lint:design-system` (`scripts/design-system-check.ts`). A line opening `//`, `/*` or `*` is skipped; code with a comment after it is not |
| Do not hand-write an anchored overlay, a month grid, an edge panel or a side panel: use `Popover`, `HoverCard` or `DropdownMenu`, `Calendar`, `Drawer` and `Sidebar` | `<div className="absolute rounded-md border bg-background shadow-md">`, `grid-cols-7`, `fixed inset-y-0`, `<aside>` | `bun run lint:design-system` (`scripts/design-system-check.ts`). The overlay rule names `Popover`; which of the three it is depends on what opens it, so read the site |
| Three families have no rule, and each has a reason | hand-writing an `Item` row, a `ScrollArea` or a `Select` | unenforced. A list row and a scroll container are ordinary layout, written throughout both apps, and a markup rule keyed on `<li>` or on an overflow class would report every one of them. No count is given, and GRO-1051 records why: the figures this row used to carry stated no counting method, and the four methods tried against them returned four different numbers. `Select` waits on GRO-793. A local declaration taking the library's name is still caught |
| A hand-built `Widget` is caught as a card | `<div className="rounded-lg border bg-card shadow-sm">` carrying a heading and fields | `bun run lint:design-system` (`scripts/design-system-check.ts`). `Widget` renders `Card`, so the card rule names it; `design-system-check.test.ts` pins that in `Widget is covered by the card rule` |
| An exception silences the number of occurrences it states, and no more | adding a sixth `<td>` to a file whose exception covers five | `bun run lint:design-system` (`scripts/design-system-check.ts`). The entry states a `count`: the next occurrence is reported as new, and an entry covering more than the tree holds is reported as spent |
| Import from `@neuro/ui`, never `@dealpath/ui-components` | `import { Button } from '@dealpath/ui-components'` in an app | `bun turbo boundaries` — the app does not declare the library, so the import is rejected. An app that added the dependency would pass, so the check rests on the declaration rather than on a rule naming the seam |
| Do not hand-write a composition the design system ships. A `div` given a rounded corner, a border on every side, a painted background and a shadow at once is Bolide's `Card`; import `Card` with `CardHeader`, `CardContent` and `CardFooter` | `<div className="rounded-lg border bg-card shadow-sm p-[16px]">` | `bun run lint:design-system` (`scripts/design-system-check.ts`). It reports the four treatments on one line as a card surface and names `Card` in the message. A line that also sets `absolute` or `fixed` is skipped: an overlay has its own component, and `Card` would be the wrong answer there |
| `Card` draws a lighter shadow than the markup GRO-796 replaced, and rounds a `rounded-md` box up to 8px | converting `rounded-md border bg-background shadow-sm` to `Card` and expecting the same elevation | `apps/design-system/tests/rendered-claims.browser.test.ts` reads both in Chromium over the nine converted surfaces. Colours, border widths, padding and margins agree on all nine. `Card`'s shadow is one layer at 5% black where Tailwind v4's `shadow-sm` draws two at 10%; add `shadow-sm` to the `className` to keep the old elevation |
| Pass `data-testid` to any component marked † in the menu | omitting it | `bun turbo run typecheck` — the prop is required in the component's type |
| One base `data-testid` per component; subcomponents derive theirs | passing one per rendered element | unenforced |
| Every `Widget` part appends its own suffix to the `data-testid` you give it | selecting `[data-testid="chart-x"]` after `<Widget data-testid="chart-x">` | `packages/shared/ui/src/components/ui/widget-testids.test.tsx`. The root renders `chart-x-widget`, and the header, title, body and footer each render their own suffix of the same base. The base id appears on no element, so an exact-match selector finds nothing and a prefix selector matches five. `apps/design-system/tests/rendered-claims.browser.test.ts` reads the same five ids from a live DOM |
| `Button` centres its label, and no class on the element changes that | `<Button className="w-full justify-start">` expecting the label on the left | `widget-testids.test.tsx`. `Button` wraps its children in a span of its own set to `w-full justify-center`, so the span fills the button and centres what you passed. `apps/design-system/tests/rendered-claims.browser.test.ts` reads the label's own box in Chromium and finds it at the button's centre. Use a plain `<button>` for a left-aligned row until GRO-450 gives Bolide a left-aligned form |
| `Badge` renders `badgeText`, not children | `<Badge badgeText="">3</Badge>` | unenforced — `badgeText` is required by the type, but children are silently discarded unless `asChild` is set, so the badge renders empty |
| Read a token as `hsl(var(--x))` or use the utility; never name a `--color-*` outside the `@theme` block | `ring-[var(--color-ring)]`, `border-color: var(--color-border)` | `packages/shared/ui/src/styles/styles.test.ts` — scans every `.ts`, `.tsx`, `.mdx` and `.css` under `apps/` and `packages/` |
| Every token you reference must be defined in the sheet | a token name that only exists under `.dark`, or a typo | `styles.test.ts` — an undefined token renders as no colour rather than erroring |
| No hex values and no Tailwind palette classes; use the semantic tokens | `bg-blue-500`, `text-[#0A0A0A]` | unenforced — `styles.test.ts` checks that a token resolves, not that a colour came from one |
| No `dark:` variants | `dark:bg-amber-950` | unenforced. The sheet declares `@custom-variant dark (&:is(.dark *))`, so `dark:` keys off an ancestor `.dark` class and does not read `prefers-color-scheme`. Only the Storybook's theme toolbar writes that class; no app does, so a `dark:` utility in an app never applies |
| `border-*` sets border WIDTH, not colour | expecting `border-2` to change the colour | unenforced — `globals.css` gives every element `border-color: hsl(var(--border))`, so a width utility inherits the token colour and a colour needs naming separately |
| Restyle a Bolide component through its props, not by passing a colliding utility in `className` | `<Button className="bg-white">` expecting your background to win | unenforced — Bolide's published stylesheet is compiled with Tailwind's `important` flag, so its own utility wins wherever the two collide. `packages/shared/ui/src/styles/bolide-dark.css` is the exception and its header explains the two things an override needs |
| A component from `@neuro/ui` renders in a client component | rendering one from a server component | unenforced. The library is one module with no `'use client'` and six top-level `createContext` calls, so the boundary lands at the call site. `apps/dpagentic/src/features/entity/components/create-menu.tsx` is the arrangement to copy: a server component renders a client leaf |
| A new shared component needs a story, in the same change | exporting a component from `@neuro/ui` and drawing it in no story | `apps/design-system/src/stories/neuro-local-coverage.test.ts` for a component Neuro adds of its own, and `inventory-coverage.test.ts` beside it for a Bolide family. Each reads the code of every story file and fails naming what no story draws |

`bun run lint:design-system` enforces the second import rule against a baseline that only shrinks. `scripts/design-system-baseline.json` lists what is already accepted or excepted, a new bypass fails CI, and removing one fails too until the same commit re-records the baseline. The check reads one line of source at a time, so a `className` spread over several lines or assembled through `cn()` is outside it, and AG Grid builds its cells at run time where no static check reaches.

## What to read next

1. `apps/design-system/AGENTS.md` — the fuller rules for building a screen: the field layer, the four states every data surface owes a reader, and the form rules that corrupt data when they are wrong. Not loaded automatically; read it before building a surface.
2. `02-bolide-fitness.md` — where the library fights how Neuro builds, measured, with the recommendation for each.
3. `03-ownership-and-contribution.md` — where a new component belongs, how to ask for one, and when one is finished.
4. `00-design-system-reference.md` — the Storybook itself: what it renders, what it cannot, and how to run it.

## The component menu

Everything below is exported from `@neuro/ui` today. A name here is a component you must not hand-write.

<!-- BEGIN GENERATED: @neuro/ui inventory -->

Generated from `@neuro/ui`'s exports at `@dealpath/ui-components` 2.4.0. Run `bun run --filter @neuro/ui inventory` to regenerate; `inventory.test.ts` fails while this block and the package disagree.

243 exports: 52 component families, 4 constants, 17 hooks and helpers. † marks a component that will not typecheck without `data-testid`.

| Family | Exports |
| --- | --- |
| `Accordion` | `Accordion`†, `AccordionContent`†, `AccordionItem`, `AccordionTrigger`† |
| `Alert` | `Alert`, `AlertActions`, `AlertDescription`, `AlertDismiss`†, `AlertTitle` |
| `Avatar` | `Avatar`† |
| `Badge` | `Badge`† |
| `BoardView` | `BoardView` |
| `Breadcrumb` | `Breadcrumb`†, `BreadcrumbDropdown`, `BreadcrumbDropdownItem`, `BreadcrumbEllipsis`†, `BreadcrumbEllipsisDropdown`, `BreadcrumbItem`†, `BreadcrumbLink`†, `BreadcrumbList`†, `BreadcrumbPage`†, `BreadcrumbSeparator`† |
| `Button` | `Button`†, `ButtonGroup`†, `ButtonGroupSeparator`, `ButtonGroupText`† |
| `Calendar` | `Calendar` |
| `Card` | `Card`†, `CardAction`†, `CardContent`†, `CardDescription`†, `CardFooter`†, `CardGrid`, `CardHeader`†, `CardTitle`† |
| `ChartSection` | `ChartSection` |
| `Checkbox` | `Checkbox` |
| `Combobox` | `Combobox`, `ComboboxCollection`, `ComboboxContent`, `ComboboxEmpty`, `ComboboxGroup`, `ComboboxInput`, `ComboboxItem`, `ComboboxLabel`, `ComboboxList`, `ComboboxPrimitiveRoot`, `ComboboxSeparator`, `ComboboxTrigger`, `ComboboxV2`, `ComboboxV2Chip`†, `ComboboxV2Chips`, `ComboboxV2ChipsInput`, `ComboboxV2Collection`, `ComboboxV2Content`, `ComboboxV2DefaultPopupTrigger`†, `ComboboxV2Empty`, `ComboboxV2Group`†, `ComboboxV2Input`, `ComboboxV2Item`, `ComboboxV2Label`†, `ComboboxV2List`†, `ComboboxV2Separator`†, `ComboboxV2Trigger`†, `ComboboxV2Value`, `ComboboxValue` |
| `Command` | `Command`, `CommandEmpty`, `CommandGroup`, `CommandInput`, `CommandItem`, `CommandList`, `CommandSeparator`, `CommandShortcut`† |
| `DataTable` | `DataTable` |
| `Dialog` | `Dialog`, `DialogClose`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogFooterEnd`, `DialogFooterStart`, `DialogHeader`, `DialogOverlay`, `DialogPortal`, `DialogTitle`, `DialogTrigger` |
| `DockedDrawerContent` | `DockedDrawerContent` |
| `DockedPanel` | `DockedPanel` |
| `Drawer` | `Drawer`, `DrawerClose`, `DrawerContent`, `DrawerDescription`, `DrawerFooter`, `DrawerHeader`, `DrawerOverlay`, `DrawerPortal`, `DrawerTitle`, `DrawerTrigger` |
| `DropdownMenu` | `DropdownMenu`, `DropdownMenuCheckboxItem`, `DropdownMenuContent`, `DropdownMenuGroup`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuPortal`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, `DropdownMenuSeparator`, `DropdownMenuSub`, `DropdownMenuSubContent`, `DropdownMenuSubTrigger`, `DropdownMenuTrigger` |
| `Empty` | `Empty` |
| `Field` | `Field`†, `FieldContent`†, `FieldDescription`†, `FieldError`†, `FieldGroup`†, `FieldLabel`, `FieldLegend`†, `FieldSeparator`†, `FieldSet`†, `FieldTitle`† |
| `HoverCard` | `HoverCard`, `HoverCardBody`, `HoverCardContent`, `HoverCardHeader`, `HoverCardHeaderActions`, `HoverCardTrigger` |
| `HoverHint` | `HoverHint` |
| `Input` | `Input`†, `InputGroup`†, `InputGroupAddon`†, `InputGroupButton`†, `InputGroupInput`†, `InputGroupText`†, `InputGroupTextarea`† |
| `Item` | `Item`, `ItemActions`, `ItemContent`, `ItemDescription`, `ItemFooter`, `ItemGroup`, `ItemHeader`, `ItemMedia`, `ItemSeparator`, `ItemTitle` |
| `Kbd` | `Kbd`, `KbdGroup` |
| `Label` | `Label` |
| `LoadingDashboardEmptyState` | `LoadingDashboardEmptyState` |
| `MapSection` | `MapSection` |
| `MatrixSection` | `MatrixSection` |
| `NearbySection` | `NearbySection` |
| `NotesSection` | `NotesSection` |
| `NotificationsIcon` | `NotificationsIcon`† |
| `Popover` | `Popover`, `PopoverAnchor`, `PopoverContent`, `PopoverDescription`, `PopoverFooter`, `PopoverHeader`, `PopoverTitle`, `PopoverTrigger`, `PopoverViewAllButton` |
| `PortalContainerContext` | `PortalContainerContext` |
| `RadioGroup` | `RadioGroup`, `RadioGroupItem`, `RadioGroupItemDescription`, `RadioGroupItemTitle` |
| `ScrollArea` | `ScrollArea`, `ScrollAreaCorner`, `ScrollAreaViewport` |
| `ScrollBar` | `ScrollBar` |
| `SectionView` | `SectionView` |
| `Separator` | `Separator` |
| `Sidebar` | `Sidebar`, `SidebarContent`, `SidebarFooter`, `SidebarGroup`, `SidebarHeader`, `SidebarMenu`, `SidebarMenuButton`, `SidebarMenuItem`, `SidebarProvider`, `SidebarSeparator`, `SidebarTrigger` |
| `Skeleton` | `Skeleton` |
| `Spinner` | `Spinner` |
| `SummaryTable` | `SummaryTable` |
| `SvgGradient` | `SvgGradient` |
| `SvgIcon` | `SvgIcon` |
| `Switch` | `Switch` |
| `Table` | `Table`, `TableBody`, `TableCaption`, `TableCell`, `TableFooter`, `TableHead`, `TableHeader`, `TableRow` |
| `Tabs` | `Tabs`, `TabsContent`, `TabsGroup`, `TabsList`, `TabsTrigger` |
| `Toaster` | `Toaster` |
| `Tooltip` | `Tooltip`, `TooltipContent`, `TooltipProvider`, `TooltipTrigger` |
| `Widget` | `Widget`†, `WidgetBody`†, `WidgetDragHandle`†, `WidgetEmpty`†, `WidgetField`†, `WidgetFields`†, `WidgetFooter`†, `WidgetHeader`†, `WidgetMedia`†, `WidgetSkeleton`† |

**Constants**: `DEFAULT_MAX_LIST_HEIGHT`, `DEFAULT_ROW_HEIGHT`, `DRAWER_HEADER_TAB_CLASSES`, `SCOPE_NOTE`

**Hooks and helpers**: `buttonGroupVariants`, `buttonTriggerClassname`, `cn`, `defaultFilterItem`, `defaultGroupRenderer`, `defaultItemRenderer`, `getButtonTrigger`, `getComputedListHeight`, `getQueryFilteredGroups`, `getVirtualizedRows`, `getVisibleVirtualizedGroups`, `hasNoGroupItems`, `isItemSelected`, `recordHref`, `toast`, `useComboboxV2Anchor`, `useSidebar`

<!-- END GENERATED: @neuro/ui inventory -->
