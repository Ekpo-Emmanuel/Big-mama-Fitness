# Organizer admin redesign

## Audit and organizer workflow

The original admin had an event list, overview, guests, check-in, leads, feedback, and a login redirect. It lacked persistent event navigation and a dedicated event-details page. Marketing-section padding consumed too much mobile space. Eight equally weighted metrics obscured arrival tasks. Guest management lacked search and filters; incomplete attempts extended the same page. Every check-in submitted a form and navigated away, losing the organizer's position. Waiver text dominated expanded details, and unusual actions had no confirmation step. Technical delivery terminology appeared in the overview without explaining its scope. Loading and recovery states were missing.

The revised workflow is: choose an event, assess sales and expected attendance, manage paid guests or incomplete attempts, switch to dedicated check-in, then review feedback and future-class interest. Event details remain available throughout.

## Information architecture and navigation

- All events: compact event cards with dates, location, and publication status.
- Overview: four operational metrics, guest actions, incomplete/cancelled/no-show counts, feedback and lead links.
- Guests: paid guests first, with separate incomplete and cancelled/refunded groups.
- Check-in: search, arrival filters, count, one-tap action, shared-data refresh.
- Feedback: rating, response count/rate, sentiment distribution, readable responses.
- Future-event leads: searchable contacts, consent status, and clear future-class wording.
- Event details: schedule, venue, ticket configuration, approved waiver, and public event link.

Desktop uses compact horizontal navigation. Mobile uses fixed Overview, Guests, Check-in, and More navigation with safe-area spacing. More exposes feedback, leads, and details. Active pages have explicit labels and `aria-current`. Native disclosure controls work with keyboard navigation.

## Shared components and visual system

`admin-ui.tsx` provides page headers, status badges, panels, buttons, metrics, details, empty states, and consistent date/currency formatting. Existing cream, plum, lilac, typography, and rounded controls remain the design foundation. All product styling uses Tailwind. No new dependencies were added.

`admin-navigation.tsx` provides responsive event navigation. `admin-guests.tsx` handles guest search, registration groups, arrival filters, detail disclosure, actions, and confirmation dialogs. `admin-leads.tsx` handles lead search and consent details. Native dialogs provide focus containment, Escape dismissal, and focus return without a dialog dependency.

## Mobile and guest management

Guest cards wrap long names and addresses without desktop tables. Search and filters stay at the top of the viewport. Controls provide at least 44px touch targets. Waiver snapshots are nested and height-limited; contact, payment, registration, consent, and referral information are grouped separately. Cancel/refund/no-show actions require review in a confirmation dialog. Refund copy explicitly says the action records an already completed Stripe refund and does not send money or reopen inventory.

Check-in retains the current search/filter state, announces successful changes, disables submissions while saving/refreshing, and shows inline failures. Counts and rows refresh every 30 seconds while visible and when the window regains focus. Conflicting updates still use backend validation. No undo was added because the backend has no safe undo operation.

## Feedback and leads

Feedback shows average rating, response count, eligible response rate, and labeled sentiment meters. Individual responses separate what guests enjoyed from suggestions. Future-event leads have search, readable contacts, consent badges, and disclosure for source/timestamps. They are explicitly not a cancellation waitlist.

## Functional scope and safety

Better Auth, organizer authorization, shared organizer data, Convex mutations and queries, Stripe rules, capacity, pending deduplication, waiver snapshots, feedback, CSV export, email scheduling, analytics, and canonical URLs remain unchanged. Existing admin seeding behavior is preserved. No production data was intentionally changed and no deployment was performed.

The only API change is content negotiation on the existing attendee POST endpoint: `Accept: application/json` receives `{ ok: true }` after the same authorized mutation. Ordinary form requests retain their 303 redirect. Origin validation, authorization, and error responses remain intact.

The new client guest payload explicitly excludes confirmation/feedback tokens, request keys, checkout URLs, payment identifiers, and internal actor IDs. Event configuration remains read-only. The existing overview delivery count spans all events; its copy now discloses that scope and does not imply every queued message has failed.

## Files changed for this redesign

- `app/admin/(protected)/layout.tsx`, `page.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`
- `app/admin/(protected)/events/[id]/layout.tsx`, `page.tsx`, `[view]/page.tsx`
- `app/api/admin/attendees/[id]/route.ts`
- `components/admin-ui.tsx`, `admin-navigation.tsx`, `admin-guests.tsx`, `admin-leads.tsx`
- `components/login-form.tsx`
- `lib/admin-guest.ts`
- `tests/admin.test.ts`, `vitest.config.ts`, `e2e/platform.spec.ts`
- `scripts/admin-preview/*` and `artifacts/admin/*`
- `ADMIN-REDESIGN.md`

Pre-existing public-page, registration, payment, and content edits were not reverted or included in this redesign's functional scope.

## Verification

- `npm run typecheck`: passed.
- `npm run lint`: passed with two existing unused-import warnings in public registration/event CTA files.
- `npm run build`: passed.
- Node test stage of `npm test`: 6 passed.
- `npx vitest run --maxWorkers=1 --testTimeout=30000`: 96 passed, including six new admin safety tests.
- Initial default Vitest run: 88 passed and two capacity tests timed out at 5 seconds during concurrent local work. The complete single-worker rerun passed.
- Browser QA: 70 page/viewport checks passed at 320, 375, 390, 430, 768, 1024, and 1440px, with no horizontal overflow. Check-in, retained search, filters, incomplete separation, refund dialog, Escape, failure recovery, and empty states passed. The expanded guest view had zero serious or critical axe violations.
- Additional edge checks: refund dialogs fit all seven widths; Escape restores trigger focus; mobile More navigation opens the requested page and closes the menu.
- Browser QA uses actual admin route components and local, fictional fixtures. Server queries, authorization, navigation, and writes are isolated through the preview harness. The harness is outside application routes and cannot bypass production authorization.
- The existing end-to-end setup seeds an external Convex deployment, so it was not used. No live login, email, payment, or production check-in was exercised.

Build first so the preview can reuse the compiled Inter font. Run the isolated preview with `node scripts/admin-preview/server.mts`, then run `node scripts/admin-preview/qa.mjs` and `node scripts/admin-preview/edge-qa.mjs`. Browser results and screenshots are written under `artifacts/admin/`.

## Remaining product considerations

- A full live staging smoke test with two organizer sessions would verify the deployed authentication and refresh behavior end to end.
- Shared data refresh is periodic rather than an immediate subscription; updates from another organizer can take up to 30 seconds.
- Event editing, per-event scheduled-message inspection, and check-in undo require additional backend capabilities and remain outside this UI redesign.
- The production public URL could not be retrieved by the web tool. Local finished public components and existing brand tokens supplied the visual reference.


