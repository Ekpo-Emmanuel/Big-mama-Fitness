# Big Mama Fitness

Event registration for [Big Mama Fitness](https://www.bigmamafit.ca). The current class is Brenda's Afro Dance Fitness session in Nanaimo on October 17, 2026. Built from `comprehensive_guide.md` and `short_brief.md`. The public experience uses Tailwind CSS throughout.
f
## Current status

The application is implemented locally, including landing page, registration, Stripe integration, capacity enforcement, future-event leads, organizer tools, email jobs, analytics, and SEO. It has not been deployed or connected to live Stripe, email, or analytics accounts. Checkout intentionally remains unavailable until Stripe, the public origin, and an approved versioned waiver are configured. No legal waiver, refund policy, instructor credentials, reviews, or event photographs were invented.

## Stack and architecture

- Next.js 16.3.6 App Router, React 19, TypeScript, Tailwind CSS 4.
- Convex is the application database. Event, attendee, lead, checkout, webhook, job, and rate-limit records live there.
- Better Auth email/password for organizers, stored in Convex through `@convex-dev/better-auth`.
- Stripe-hosted Checkout; verified webhooks are the sole payment-confirmation authority.
- Durable delivery jobs with a Resend adapter and a GA4 Measurement Protocol purchase adapter.
- Local Anton display font with system body fonts. No external font request.

## Local setup

1. Install Node 24+ and run `npm ci`.
2. Copy `.env.example` to `.env.local`.
3. Run `npx convex dev` and copy `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, and `NEXT_PUBLIC_CONVEX_SITE_URL` into `.env.local`.
4. Generate secrets and set them locally and on the Convex deployment:

```text
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npx convex env set BETTER_AUTH_SECRET <secret>
npx convex env set SITE_URL http://localhost:3000
npx convex env set CRON_SECRET <same-as-local-CRON_SECRET>
```

5. Create an organizer: `npm run admin:create -- you@example.com your-strong-password`
6. Run `npm run dev`, then open [the event](http://localhost:3000/event/afro-dance-fitness).
7. Sign in at `/login`. Public organizer signup stays closed. Repeat `admin:create` for each additional organizer.

Useful commands:

```text
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run format
npm run admin:create
npm run convex:dev
```

Browser tests use installed Microsoft Edge, a separate server on port 3100, and a uniquely named test database under `data/`. They never modify the normal event database. To use Chromium elsewhere, change the Playwright channel or install Chromium and omit the Edge channel.

## Event content and waiver configuration

Event information is stored as validated JSON in the `events` table. Export it, edit the JSON, and import it:

```text
npm run event:config -- export afro-dance-fitness event-config.json
npm run event:config -- import event-config.json
```

The export refuses to overwrite an existing file. The command loads `.env.local` when present. Configure `waiverText` and `waiverVersion` together using organizer-approved text. Each registration stores an immutable copy and acceptance timestamp. Marketing consent is separate and is never required to buy a ticket.

Set `contactEmail`, real instructor copy, and local media paths here. Put approved files in `public/media/` and use paths such as `/media/brenda.webp`. Hero video needs a poster image; use a compressed silent clip. Controls and reduced-motion behavior are provided. Images use Next Image.

For a future event, use a new `id` and `slug`, then update the dates and content. The root redirect currently uses the initial event slug in `lib/event.ts`. Marketing benefits and FAQs live in `lib/content.ts`.

Configuration imports reject invalid schedules, capacity above 20, capacity below existing sales, incomplete waiver versions, and external media URLs. Active checkout holds must be resolved before editing event configuration. This prevents changing a live checkout's inventory contract.

## Database schema

Convex tables:

| Table | Purpose |
| --- | --- |
| events | Event content, publication flags, `soldCount`, `heldCount` |
| attendees | Contact, waiver snapshot, consent, UTMs, payment/attendee/inventory status, Stripe ids |
| checkoutRecords | Immutable Stripe request parameters and expected amount |
| futureEventLeads | Separate marketing contacts, unique per source event and email |
| webhookReceipts | Deduplicates processed Stripe event IDs |
| jobs | Confirmation, organizer, reminder, follow-up, and purchase jobs |
| rateLimits | Shared rate-limit counters |
| organizers | Active admin accounts linked to Better Auth user ids |

Better Auth user/session tables live in the Convex Better Auth component, not in a second application database.

## Capacity and payment safety

Convex mutations are transactions. `soldCount` and `heldCount` live on the event document. Reserve increments `heldCount` and inserts the attendee in the same mutation. Confirm-payment decrements `heldCount` and increments `soldCount` in the same mutation. If two mutations write the event row, Convex retries the loser so it re-reads the counters. A 21st paid seat throws `Inventory invariant violated` and Stripe retries; the webhook receipt is not stored until the mutation succeeds. Duplicate Stripe event IDs return early from `webhookReceipts`. Cancellation, no-show, check-in, and refund recording never decrement `soldCount`.

Network uncertainty retains the hold. Checkout creation uses a stable Stripe idempotency key. A Convex scheduled function at `expiresAt` looks up the Stripe session and records confirmed expiration. `npm run stripe:reconcile` can do the same locally. Ambiguous reservations then need operator review in Stripe; do not release them merely because time has elapsed. Paid tickets are confirmed only by the signed Stripe webhook (or an expired unpaid session). Replay the missing webhook if a paid hold remains unresolved.

The public count is successful sales only. If all remaining places are currently held in checkout, the API gives a clear retry message. Availability refreshes every 30 seconds and on window focus.

## Stripe setup

Local test-mode (CLI, `stripe listen`, test cards): see `STRIPE_DEV.md`. Do not use live keys.

1. Use a separate Stripe sandbox for development. Create a restricted API key with the Checkout create/read permissions needed by this integration. Configure `STRIPE_SECRET_KEY` in the server environment.
2. Configure the required webhook endpoint at `https://www.bigmamafit.ca/api/webhooks/stripe`.
3. Subscribe to:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
4. Put that endpoint's signing secret in `STRIPE_WEBHOOK_SECRET`.
5. Configure `APP_URL` (`https://www.bigmamafit.ca` in production, `http://localhost:3000` locally) and import the approved waiver.
6. For local forwarding, run Stripe CLI `stripe listen --forward-to localhost:3000/api/webhooks/stripe` and use the signing secret it prints.
7. Verify a sandbox purchase, abandoned Checkout, delayed payment, duplicate webhook, and final-seat behavior before using live credentials.

Checkout uses the server-configured CAD amount and a quantity of one. Dynamic payment methods are managed in Stripe. No browser publishable key is needed for hosted Checkout. The optional publishable-key variable is reserved for a future embedded flow.

Refunds are issued in Stripe separately. The organizer's “Record completed refund” action only records a full refund already issued. Partial refunds and automated Stripe refund synchronization are not implemented. Neither refund path reopens inventory. Tax collection is not enabled; the organizer must determine the correct tax treatment before launch.

Official reference: [Stripe Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment).

## Organizer access and usage

Create organizers with `npm run admin:create -- email password [displayName]`. Public signup is disabled (`disableSignUp`). Sign in at `/login` with email and password. Better Auth owns the session cookie. Admin access requires that session plus an active `organizers` row. All active organizers share the same permissions and the same event, guest, and lead data. Check-in, cancel, and other guest updates store `checkedInBy` / `cancelledBy` / `updatedBy` as the actor's Better Auth user id.

Changing Better Auth secrets invalidates organizer sessions. There is no public signup, password-reset email, teams, or role system.

Sign in at `/login`. Choose the event to see sold tickets, expected attendance, check-ins, no-shows, cancellations, gross sales, revenue after recorded refunds, leads, checkout holds, and queued jobs.

- Guests: inspect contact details, accepted waiver snapshot, consent, attribution, and timestamps.
- Event-day check-in: tap “Check in”; the mobile check-in view stays open.
- Cancellation and no-show: update attendance without reopening inventory.
- Refund recording: use only after issuing the refund in Stripe.
- CSV exports: authenticated, with formula-injection protection and explicit consent fields.
- Leads: use only appropriately consented contacts for future-event marketing. Duplicate lead submissions do not overwrite previous consent.

## Email and scheduler setup

Mail sends inside Convex actions, not Next.js. `EMAIL_FROM`, `EMAIL_REPLY_TO`, and `SITE_URL` are server-only. Do not prefix them with `NEXT_PUBLIC_`.

Production Convex:

```text
npx convex env set RESEND_API_KEY <key>
npx convex env set EMAIL_FROM "Big Mama Fitness <info@bigmamafit.ca>"
npx convex env set EMAIL_REPLY_TO "info@bigmamafit.ca"
npx convex env set SITE_URL "https://www.bigmamafit.ca"
npx convex env set EMAIL_PRODUCTION true
```

Unset `EMAIL_TEST_REDIRECT` and `ALLOW_EMAIL_TEST_REDIRECT` on production Convex before `EMAIL_PRODUCTION=true`. Do not use `onboarding@resend.dev` as `EMAIL_FROM` in production.

Local Convex (DEV deployment). Keep `SITE_URL` on localhost or Better Auth sign-in returns 403:

```text
npx convex env set SITE_URL http://localhost:3000
# Optional: redirect every outbound message to one inbox while testing providers
npx convex env set EMAIL_TEST_REDIRECT <your inbox for local tests>
npx convex env set ALLOW_EMAIL_TEST_REDIRECT true
# Real recipients (guest + organizers): remove the redirect
npx convex env remove EMAIL_TEST_REDIRECT
```

Never set production `SITE_URL=https://www.bigmamafit.ca` on the **dev** Convex deployment.
See `ENVIRONMENTS.md` for DEV vs PROD separation.

`SITE_URL` is the public origin for Better Auth and for links inside transactional email: event page, Google Calendar details, `.ics` file, and follow-up CTA. Next.js uses `APP_URL` for the same public origin (`https://www.bigmamafit.ca` in production). Apex `https://bigmamafit.ca` permanently redirects to www. If `SITE_URL` is unset, email links fall back to `APP_URL`, then `http://localhost:3000`. `CRON_SECRET` is unrelated to email and to cron. See [CRON_SECRET](#cron_secret).

Verify the Resend sending domain `bigmamafit.ca` before production mail. The sender address is `info@bigmamafit.ca`. Add the DNS records Resend shows (SPF and DKIM) at GoDaddy. This repository does not change DNS.

Active organizers plus `ORGANIZER_EMAIL` (and the event `contactEmail` if set) receive registration notices. Duplicate addresses are merged by case-insensitive email.

After a verified Stripe payment, the same Convex mutation schedules:

- Guest confirmation via `ctx.scheduler.runAfter(0, …)`
- Organizer notification via `runAfter(0, …)`
- GA4 purchase via `runAfter(0, …)`
- A reminder 24 hours before `startsAt` via `runAt`
- A same-day reminder 3 hours before `startsAt` via `runAt`
- A follow-up 2 hours after `endsAt` via `runAt`

Display copy uses `event.timezone` (`America/Vancouver`). Schedule instants use `Date.parse` on ISO timestamps with an explicit offset, not the server’s local zone. October 17, 2026 5:00 PM in Nanaimo is PDT (`-07:00`).

Reminders already in the past at purchase time are not scheduled. Cancel and refund cancel pending scheduled functions and re-check attendee status immediately before send. Paid attendee state does not depend on Resend success. Failed sends log `emailDeliveries`, retry with backoff, and move to `needs_review` after 23 hours. Resend `Idempotency-Key` is the stable job id. Guest list shows confirmation Sent / Failed / Not sent. Organizers can retry only from `needs_review`.

Local Stripe hold expiry backup: `npm run stripe:reconcile`. Production expiry still uses the signed Stripe webhook first; Convex also schedules a hold check at reservation `expiresAt`.

Consent withdrawals received by reply need organizer handling in the contact records before the next campaign; no bulk marketing or unsubscribe automation is included.

## GA4, GTM, and attribution setup

Browser events:

```text
page_view
reserve_spot_click
registration_start
registration_submit
checkout_start
sold_out_view
future_event_lead_submit
```

`purchase` is sent only by the confirmed-payment job, never by a success-page visit. It includes a stable Stripe transaction ID, CAD currency, value 10 for the initial event, and one event-ticket item. The unique job prevents normal duplicate processing; GA4's transaction identifier supports deduplication of ambiguous delivery retries. External delivery is not a mathematically exact-once network guarantee.

Set `NEXT_PUBLIC_GTM_ID` and `NEXT_PUBLIC_GA_MEASUREMENT_ID`. In GTM:

1. Configure the Google tag for your GA4 web stream.
2. Disable automatic page-view sending and enhanced-measurement form/history events that would duplicate these explicit events.
3. Create Data Layer Variables for `event_id`, `event_name`, `ticket_price`, `currency`, `spots_remaining`, the four UTM keys, `page_location`, `client_id`, and `session_id`.
4. Set the Google tag client ID from the `client_id` variable so server purchases can correlate with the browser.
5. Trigger GA4 event tags for the listed custom events. Use the supplied clean `page_location`; do not send raw URL queries, confirmation tokens, form fields, names, phones, or emails.
6. Do not create a browser purchase tag. The server owns that event.
7. Preview the container, inspect GA4 DebugView/Realtime, and publish after verifying it.

If GTM is absent, the GA4 ID enables a direct Google tag fallback. Both are never installed as competing tag loaders.

Create a Measurement Protocol API secret for the same web stream and put it in server-only `GA_API_SECRET` on the Convex deployment. A scheduled Convex action delivers the purchase event after paid confirmation. Verify payloads against Google's validation endpoint before launch; a successful collect HTTP response alone does not prove correct GA4 reporting. See [Google's Measurement Protocol guide](https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events).

First-touch UTMs persist for 30 days in browser storage and are copied to attendee or lead records. Values use letters, digits, underscores, and hyphens. Analytics forwards only campaign values defined in `lib/attribution.ts`; add new approved campaign values there. This prevents arbitrary URL input from entering analytics. Storage-blocked browsers retain attribution within the current app session, but full cross-page persistence cannot be guaranteed without browser storage.

Example links:

```text
/event/afro-dance-fitness?utm_source=poster&utm_medium=qr&utm_campaign=october17&utm_content=gym_lobby
/event/afro-dance-fitness?utm_source=instagram&utm_medium=social&utm_campaign=october17&utm_content=profile
/event/afro-dance-fitness?utm_source=facebook&utm_medium=social&utm_campaign=october17&utm_content=post
```

The campaign map also includes workplace posters, cafe posters, and direct messages. Do not put personal information into campaign links.

## SEO and Search Console

Event metadata, canonical URLs, Open Graph/Twitter metadata, generated PNG share images, and schema.org Event data come from the event configuration. Availability uses actual inventory/state. The sitemap includes published events only. Registration, confirmation, API, and organizer paths are excluded from indexing.

Set `GOOGLE_SITE_VERIFICATION` to the supplied Search Console HTML verification token, rebuild, and verify the property for `https://www.bigmamafit.ca`. Alternatively, configure DNS verification with the domain host. Submit `https://www.bigmamafit.ca/sitemap.xml`. Set `APP_URL=https://www.bigmamafit.ca` before building production so static metadata and robots use that domain. Apex `https://bigmamafit.ca` should permanently redirect to www.

## Route map

| Route | Purpose |
| --- | --- |
| / | Redirect to initial event while retaining supported UTMs |
| /event/[slug] | Public event landing page |
| /event/[slug]/register | Short registration and waiver form |
| /event/[slug]/success | Read-only payment status via opaque token |
| /event/[slug]/opengraph-image | Generated share PNG |
| /api/events/[id]/checkout | Validated, rate-limited Checkout creation |
| /api/events/[id]/leads | Separate future-event lead capture |
| /api/webhooks/stripe | Signature-verified payment/expiry events |
| /login | Organizer authentication |
| /admin | Event list |
| /admin/events/[id] | Event overview |
| /admin/events/[id]/guests | Guest details and statuses |
| /admin/events/[id]/leads | Future-event leads |
| /admin/events/[id]/check-in | Mobile check-in |
| /api/admin/events/[id]/export?kind=guests | Guest CSV; use kind=leads for lead CSV |
| /api/admin/attendees/[id] | Protected attendance/refund-state changes |
| /api/auth/[...all] | Better Auth handlers |
| /robots.txt, /sitemap.xml | Search discovery |

## Environment variables

All variables are listed in `.env.example`. Only `NEXT_PUBLIC_*` values are bundled for the browser. Stripe keys, webhook secrets, Better Auth secrets, `CRON_SECRET`, email keys, and the GA API secret remain server-side. `CRON_SECRET`, `BETTER_AUTH_SECRET`, and `SITE_URL` must be set on the Convex deployment. Resend variables must also be set on Convex because email actions run there. Rebuild after changing public analytics IDs.

### CRON_SECRET

`CRON_SECRET` is not related to cron. The email polling cron has been removed. It is the shared internal secret that Next.js server code and local scripts send when they call protected Convex functions.

Keep it server-only. Never give it a `NEXT_PUBLIC_` prefix. Next.js and the Convex deployment must use the same value. The minimum length is 32 characters.

```text
npx convex env set CRON_SECRET <same-as-local-CRON_SECRET>
```

TODO: After the application is stable, rename this to `INTERNAL_API_SECRET` in stages. Keep `CRON_SECRET` working until Next.js and Convex both use the new name. Do not rename it during this development cycle.

## Design handoff and reusable components

The requested Astra design is already implemented as a warm, energetic event-poster composition. All new UI uses Tailwind utility classes and theme tokens.

- `components/event-sections.tsx`: hero, benefits, beginner reassurance, experience, schedule, instructor, offer, availability, FAQ, final CTA, sticky mobile CTA.
- `components/event-cta.tsx`: preserve its event-state and analytics contract when restyling.
- `components/registration-form.tsx` and `future-event-lead-form.tsx`: matching forms, consent, errors, and tracking.
- `components/event-media.tsx`: real video with poster, controls, and reduced-motion handling.
- `components/social-proof.tsx`: hidden until real testimonials are provided. Pass only verified quotes and sources.
- `components/ui.tsx` and `app/globals.css`: shared Tailwind patterns and theme tokens.
- `lib/content.ts` and event configuration: editable copy.

No design change requires edits to payment, database, or inventory modules. The only inline layout exception is the server PNG renderer, which has no Tailwind DOM stylesheet.

## Verification and remaining launch decisions

See `IMPLEMENTATION.md` for phase gates and final results. Unit/integration tests cover the guide's business cases, including real independent-worker contention for the last seat. Browser tests cover all requested viewport widths, accessibility, lead capture, registration payload/attribution, auth, check-in, CSV, protections, and SEO. The browser payment handoff is intercepted; no real Stripe payment is performed.

Before launch, provide or decide:

- Live domain and persistent Node hosting, backups, and scheduler.
- Stripe sandbox verification, then live restricted key and required webhook.
- Approved participation waiver/version and refund policy.
- Sender domain, organizer/contact address, and email provider credentials.
- GA4/GTM configuration and Search Console verification.
- Real Brenda photos/video and final instructor story, if desired.
- Tax treatment, contact retention, and consent-withdrawal operations.

Live charges, email delivery, GA4 reporting, tax decisions, and production deployment remain unverified until those external settings are supplied. Partial refunds, automatic cancellation replacement, bulk campaigns, memberships, and multiple staff roles are intentionally outside this MVP.
#   B i g - m a m a - F i t n e s s 
 
 