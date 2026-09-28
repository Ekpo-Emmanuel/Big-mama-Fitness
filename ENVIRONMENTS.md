# Environments: DEV vs PROD

This project has two Convex deployments. Do not write production values into the
dev deployment, and do not point local Better Auth at the production site URL.

## Deployments

| Role | Convex deployment | Type |
| --- | --- | --- |
| DEV | `aromatic-hornet-650` (`dev:aromatic-hornet-650` in `.env.local`) | Personal cloud dev |
| PROD | `dusty-vole-416` | Project production |

Confirm with:

```text
npx convex deployments
npx convex env list --names-only
npx convex env list --prod --names-only
```

`npx convex env …` without `--prod` always targets the **dev** deployment selected by
`.env.local` / `CONVEX_DEPLOYMENT`. Production writes require `--prod` or
`npx convex deploy`.

## DEV (local)

Use these together:

| Variable | Where | Value |
| --- | --- | --- |
| `APP_URL` | `.env.local` | `http://localhost:3000` |
| `BETTER_AUTH_URL` | `.env.local` | `http://localhost:3000` |
| `SITE_URL` | Convex **dev** | `http://localhost:3000` |
| `STRIPE_SECRET_KEY` | `.env.local` + Convex **dev** (hold checks) | `sk_test_…` or `rk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | `.env.local` | `whsec_…` from `npm run stripe:listen` |
| `EMAIL_FROM` / `EMAIL_REPLY_TO` | Convex **dev** | Verified or test sender |
| `EMAIL_TEST_REDIRECT` | Convex **dev** | Optional. If set, every send goes there |
| `ALLOW_EMAIL_TEST_REDIRECT` | Convex **dev** | `true` only when you intentionally keep a redirect while testing safety gates |
| `EMAIL_PRODUCTION` | Convex **dev** | **Unset** |

Better Auth uses Convex `SITE_URL` as `baseURL` and `trustedOrigins`. If that value is
`https://www.bigmamafit.ca` while you open `http://localhost:3000/login`, sign-in returns **403**.

Commands:

```text
npm run env:dev:check
npm run convex:dev
npm run dev
npm run stripe:listen
```

Unset redirect to send to real form / organizer addresses on the **dev** deployment:

```text
npx convex env remove EMAIL_TEST_REDIRECT
```

## PROD (live site)

**Canonical app origin:** `https://www.bigmamafit.ca`

**Apex redirect (DNS / Vercel / host):**
`https://bigmamafit.ca` → permanent redirect (301) → `https://www.bigmamafit.ca`

| Variable | Where | Value |
| --- | --- | --- |
| `APP_URL` | Host env (Vercel / Node) | `https://www.bigmamafit.ca` |
| `BETTER_AUTH_URL` | Host env (Vercel / Node) | `https://www.bigmamafit.ca` |
| `SITE_URL` | Convex **prod** (`--prod`) | `https://www.bigmamafit.ca` |
| Stripe | Host + Convex **prod** | Live keys only when go-live is approved |
| `EMAIL_FROM` | Convex **prod** | `Big Mama Fitness <info@bigmamafit.ca>` |
| `EMAIL_REPLY_TO` | Convex **prod** | `info@bigmamafit.ca` |
| `EMAIL_PRODUCTION` | Convex **prod** | `true` |
| `EMAIL_TEST_REDIRECT` | Convex **prod** | **Unset** |
| `ALLOW_EMAIL_TEST_REDIRECT` | Convex **prod** | **Unset** |

Commands:

```text
npm run env:prod:check
npx convex deploy
npx convex env set --prod NAME value
```

Never run bare `npx convex env set SITE_URL https://www.bigmamafit.ca` while doing local
dev work. That writes the **dev** deployment and breaks localhost login.

## Scripts that touch env

| Script | Target |
| --- | --- |
| `npm run convex:dev` | Dev only |
| `npm run stripe:sync-env` | Writes test keys into `.env.local` only |
| `npm run admin:create` | Uses `.env.local` → Convex URL (dev) |
| `npm run env:dev:check` | Validates local + Convex dev |
| `npm run env:prod:check` | Validates Convex prod via `--prod` |
| `npm run convex:prod` | `convex deploy` (explicit production push) |

Do not copy secrets between environments automatically.

## Email recipients

Compose recipients (before any redirect):

- Confirmation / reminders / follow-up: `attendee.email`
- Organizer notice: active organizers + `ORGANIZER_EMAIL` + event `contactEmail`,
  deduped case-insensitively

`EMAIL_TEST_REDIRECT` overrides **only** when set to a non-empty value on the Convex
deployment that runs the email action. Empty or unset means real recipients.
