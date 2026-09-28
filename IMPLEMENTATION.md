# Implementation plan and inspection

Both `comprehensive_guide.md` and `short_brief.md` are authoritative. The user's instruction to implement the Astra design supersedes the guide's earlier design-handoff-only restriction.

## Existing application

Next.js 16.3.6 App Router, React 19.2.8, TypeScript, ESLint 9, Tailwind CSS 4 with PostCSS. Only the starter `/` route exists. No database, ORM, auth, payments, email, analytics, business components, deployment configuration, or event states exist. Reuse the App Router, TypeScript configuration, Tailwind pipeline, and lint configuration. Replace starter content and global presentation rules with Tailwind utilities and theme tokens.

## Architecture

Use Node 24 and SQLite on a persistent local disk, with parameterized SQL and immediate transactions. No ORM is needed for this small schema. A single persistent Node deployment is required; ephemeral/serverless filesystems are unsupported. Stripe Checkout and verified webhooks handle payment. Reserve inventory atomically before creating Checkout. Never release a reservation merely because local time elapsed: only authoritative Stripe expiration/failure releases it. Unknown Stripe responses retain the reservation and retry using the same idempotency key. Paid tickets remain consumed after cancellation/refund. Admin authentication uses a password hash and expiring signed, HttpOnly sessions. Email uses a durable outbox and configurable provider. Analytics has a single allowlisted abstraction.

## Phases and acceptance gates

1. Data: event, attendee, lead, reservation/payment ledger, webhook receipts, email jobs, event seed, validation and state helpers.
2. Public flow: event and registration routes, reusable Tailwind sections/forms, clear state handling.
3. Payments: Stripe provider, Checkout API, signature-verified idempotent webhook, read-only confirmation route.
4. Capacity: transactional reservations, authoritative expiration, future-event leads, concurrency tests.
5. Admin: secure login, overview, guest/lead exports, check-in, cancellation/no-show/refund state.
6. Email: confirmation/organizer jobs, reminders and follow-up, protected scheduler, configurable provider.
7. Analytics: first-touch UTM persistence, funnel events, payment-confirmed purchase delivery, GTM/GA4 configuration.
8. SEO: metadata, canonical, sitemap, robots, Event schema, Search Console verification.
9. Hardening: business scenarios, endpoint protections, browser flow and responsive verification.
10. Astra finish: polished mobile-first landing page, reusable visual system, documentation and deployment handoff.

After each phase: lint, typecheck, tests, production build. Record failures and resolve them before continuing.

## Design direction

Event-poster composition: expressive condensed display typography, readable system sans body, ivory #FFF9EF, aubergine #321B39, orange #F45D35, lilac #DFCEED, and yellow #F6D76B. Large benefit headline and a playful typographic movement panel form the signature. Human media slots accept real organizer assets; no synthetic instructor portrait or fabricated social proof. CTA and event facts remain ahead of decoration on mobile. All component styling uses Tailwind.

## Validation record

- Phase 1: lint, typecheck, 2 tests, and production build passed. Native test tools require execution outside the restricted Windows sandbox; no application failure remained.
- Phase 2: lint, typecheck, 2 tests, and production build passed. Public routes and Tailwind component system added. Payment and lead endpoints are implemented in following phases.
- Phase 3: lint, typecheck, 5 tests, and build passed. Added `lib/booking.ts`, `lib/stripe.ts`, `lib/http.ts`, Checkout/webhook routes, and read-only success page. No live payment was attempted.
- Phase 4: lint, typecheck, 10 tests, and build passed. Added leads, public lead form/API, availability refresh, and reservation reconciliation. Expiration is authoritative, never clock-only.
- Phase 5: lint, typecheck, 13 tests, and build passed. Added auth/session helpers, protected organizer routes, guest actions, CSV export, and password utility. HTTP checks confirmed anonymous dashboard redirect and export 401.
- Phase 6: lint, typecheck, 15 tests, and build passed. Added email provider, durable job processor, reminders/follow-up, and protected scheduler route. No external email was sent.
- Phase 7: lint, typecheck, 16 tests, and build passed. Added attribution/analytics modules, public analytics provider, funnel hooks, and purchase delivery. Fixed a form syntax error and initialization ordering before passing the gate.
- Phase 8: lint, typecheck, 18 tests, and build passed. Added SEO helpers, Event schema, metadata, sitemap, robots, Search Console support, and generated social PNG.
- Phase 9: lint, typecheck, 20 tests, build, and 13 browser tests passed. Added actual independent-worker contention, HTTP/security checks, request size limits, security headers, refresh-safe checkout attempts, and browser/accessibility tests. Fixed contrast and native-form Origin behavior; corrected the test's hydration race. No failed check was carried into phase 10.
- Phase 10: lint, typecheck, 21 tests, build, and all 13 browser tests passed after final typography/media/configuration changes. Bundled Anton locally, added reduced-motion media and empty real-proof slot, status refresh, validated event configuration, favicon, `.env.example`, and complete README. A final analytics-session correction adds one regression test; its final verification is recorded below.

## Browser verification

Passed widths: 320, 375, 390, 430, 768, 1024, 1280, and 1440 pixels. Checked overflow, visible primary CTA, client errors, keyboard skip link, and automated landing-page accessibility (zero violations). Exercised registration payload and first-touch attribution, sold-out lead submission, cancelled/completed states, admin login/logout, check-in, authenticated CSV, API protections, schema/canonical metadata, sitemap, robots, and PNG rendering.

The browser handoff is intercepted and domain tests use local fixtures. Real Stripe sandbox payment, provider email delivery, and live GA reporting are not claimed. Tests use isolated databases; the normal event database is not seeded with test attendees.

## Remaining external setup

No deployment was requested or performed. Live launch requires a persistent Node host, HTTPS origin, Stripe restricted key and webhook, approved waiver/version, email sender configuration, scheduler, analytics/Search Console setup, and organizer decisions on refunds/tax/retention. Real instructor assets remain optional content inputs. All UI is Tailwind; only the non-DOM PNG renderer requires inline layout.

## Final verification

Final analytics correction passed lint, typecheck, all 22 tests, production build, and the affected attribution browser test. All 13 browser tests passed before that isolated correction. Final desktop (1440px) and mobile (390px) screenshots are saved in artifacts/landing-final-desktop.png and artifacts/landing-final-mobile.png. Git whitespace validation passed.

