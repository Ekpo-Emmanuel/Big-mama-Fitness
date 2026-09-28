# Local Stripe test-mode (development only)

Do not use live keys, live products, or production webhook endpoints.

The app already creates Checkout Sessions with inline `price_data` (CAD amount from the event, quantity 1). You do **not** need a Stripe Product or Price ID.

Webhook source of truth: `/api/webhooks/stripe`. The success page does not mark a ticket paid.

## Prerequisites

- Node app: `npm run dev` (port 3000)
- Convex: `npx convex dev`
- Stripe CLI logged into a **test-mode** account: `stripe login`
- Event waiver + version in Convex (booking stays closed until both exist)
- `.env.local` gitignored; never commit secrets

## One-time CLI login

```text
stripe login
```

Confirm the CLI account is the Big Mama Fitness sandbox, not live mode. Current Stripe CLI login stores an OAuth session. `stripe config --list` shows `account_id` and `display_name` and does not show `test_mode_api_key`.

Copy the sandbox keys from Dashboard → Developers → API keys (sandbox, not live):

```text
STRIPE_SECRET_KEY=sk_test_… or rk_test_…
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…
```

Put those in `.env.local`. Hosted Checkout does not need the publishable key at runtime. Do not use `sk_live_` or `pk_live_`.

If `stripe config --list` already shows `test_mode_api_key` and `test_mode_pub_key` (or `test_mode_publishable_key`), sync them:

```text
npx tsx scripts/sync-stripe-cli-env.ts
```

For first-time local booking, seed a **test-only** waiver (not legal copy):

```text
node --env-file-if-exists=.env.local --import tsx scripts/dev-seed-test-waiver.ts
```

Replace that waiver with organizer-approved text before any real launch.

## Every local Checkout session

Terminal 1 — app:

```text
npm run dev
```

Terminal 2 — Convex (if not already running):

```text
npx convex dev
```

Terminal 3 — webhook forward:

```text
npm run stripe:listen
```

(`stripe listen --forward-to localhost:3000/api/webhooks/stripe --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired`)

When listen starts it prints `whsec_…`. Put that value in `.env.local` as `STRIPE_WEBHOOK_SECRET` (first time, or whenever you recreate the listener). Then **restart** `npm run dev` so Next.js loads the secret.

Required env (no values in this file):

- `APP_URL` (`http://localhost:3000` locally; production is `https://www.bigmamafit.ca`)
- `STRIPE_SECRET_KEY` (`sk_test_…` only)
- `STRIPE_WEBHOOK_SECRET` (`whsec_…` from `stripe listen`)
- `CRON_SECRET` (shared Next.js-to-Convex secret for Checkout session attach and payment processing; not a cron secret; server-only, never `NEXT_PUBLIC_`; same value on Convex; minimum 32 characters)
- `NEXT_PUBLIC_CONVEX_URL`

`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is optional for hosted Checkout.

## Test flow

1. Open `/event/afro-dance-fitness` → register as a fake guest.
2. Checkout uses test card `4242 4242 4242 4242`, any future expiry, any CVC, any postal code.
3. Stripe CLI should log a `checkout.session.completed` POST to `/api/webhooks/stripe`.
4. App should return `200` with `{ received: true }`.
5. Attendee `paymentStatus` is `paid`, `attendeeStatus` is `confirmed`, `soldCount` +1, guest visible in `/admin`.

Decline: `4000 0000 0000 0002`. Expect no `completed` paid webhook, attendee not confirmed, sold count unchanged.

Abandon: start Checkout, close the tab, then expire the session (`stripe checkout sessions expire cs_test_…`) or wait for `expires_at`. Expect `checkout.session.expired`, hold released, sold count unchanged.

Duplicate events: Convex `webhookReceipts` stores Stripe event ids and returns early. Resend with `stripe events resend evt_…` must not double-sell.

Capacity stays 20 paid tickets. Holds do not count as sold.

## Troubleshooting

- `Booking is not open yet` / 503: missing `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_URL`, or waiver text/version.
- `Invalid signature` / 400: `.env.local` `whsec_` does not match the current `stripe listen` process; restart listen, copy the new secret, restart Next.
- `Webhook not configured` / 503: Next still running with empty Stripe env; restart after editing `.env.local`.
- Paid in Stripe but pending in Convex: CLI not forwarding, or webhook 500 (`Processing failed` in Next logs). Replay: Stripe Dashboard → event → resend, or `stripe events resend`.
- Origin 403: `APP_URL` must match the browser origin (`http://localhost:3000`).
