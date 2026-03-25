# VirtualLaunch Developer — Claude Context

## Architecture Overview
- Frontend: Static HTML + Tailwind CSS, served via Cloudflare Pages (developer.virtuallaunch.pro)
- Backend: Cloudflare Workers (`workers/src/index.js`) + Cloudflare Pages Functions (`functions/forms/`)
- Storage: Cloudflare R2 bucket (`onboarding-records`)
- Runtime: workerd (Cloudflare); entrypoint declared in `wrangler.toml`
- Hosting: developer.virtuallaunch.pro

## Key Files
- Onboarding flow: `public/onboarding.html` (multi-step SPA: form-page → payment-page)
- Post-payment landing: `public/success.html` (reads ref from `sessionStorage('vlp_ref')`)
- Onboarding Pages Function: `functions/forms/onboarding.js` (GET / POST / PATCH)
- Worker entry (status + onboarding): `workers/src/index.js`
- Developer listing: `functions/forms/developers.js` + `public/js/developers.js`
- Support status endpoint: `workers/src/index.js` → GET `/forms/support/status?clientRef=VLP-xxx`
- Stripe webhook handler: **NOT YET IMPLEMENTED** — see Open Questions
- Session status endpoint: **NOT YET IMPLEMENTED** — see Open Questions

## Stripe Integration
- Webhook endpoint: https://api.virtuallaunch.pro/v1/webhooks/stripe
- Webhook secret: stored as env var STRIPE_WEBHOOK_SECRET — never hardcode
- Listening events: see registry.json > stripe.webhookEvents
- Success redirect URL: https://developer.virtuallaunch.pro/success.html
- Both Free and $2.99 plans redirect to success.html after Stripe Checkout
- **IMPORTANT**: As of audit date, NO Stripe SDK calls, webhook handler, or checkout session
  creation exist in this codebase. The payment page (`onboarding.html`) currently only saves
  a `plan` field to the R2 record via PATCH — it does not initiate Stripe Checkout.

## Payment State Machine
States: plan-selection → processing → completed | error
- State is never derived from redirect URL params alone
- Completed state requires webhook confirmation only
- See registry.json > paymentStates for full contract
- **Current reality**: plan state is tracked in-memory (`_loadedPlan` / `_currentRefNumber`) in
  `onboarding.html` and persisted to R2 via `plan` field. No sessionStorage payment state key
  exists yet (`vl_payment_state` is the intended key, not yet implemented).

## Self-Check Rules (run before every change)
1. Never modify webhook endpoint, secret, or event list
2. Never derive payment state from client-side redirect alone
3. After any backend change, verify the status polling endpoint still
   returns the shape in registry.json > backend.sessionStatusResponseShape
4. After any frontend change, verify all four payment states render
   without JS errors
5. If a required file is missing, stop and report — do not invent a substitute

## Audit Log
- Date: 2026-03-25
- Files read:
  - .claude/settings.local.json
  - wrangler.toml
  - workers/src/index.js
  - functions/forms/onboarding.js
  - public/onboarding.html
  - public/success.html
  - public/js/developers.js
  - public/available.html (partial)
  - contracts/registry.json
  - contracts/onboarding.json
- Nulls remaining:
  - Stripe webhook handler (no file found anywhere in repo)
  - Session status endpoint for payment polling (no `/session-status` route found)
  - `functions/forms/developers.js` not read (exists but not audited)
  - Stripe SDK version (no stripe npm dep found yet)
  - `vl_payment_state` sessionStorage key not yet implemented
- Open questions:
  - Is Stripe Checkout integration planned but not yet implemented, or is it handled externally?
  - Which service hosts the Stripe webhook receiver — Cloudflare Worker, Pages Function, or external?
  - Does `success.html` need to poll a session-status endpoint, or is ref from sessionStorage sufficient?
  - Should `selectPlan('free')` still initiate Stripe Checkout (free trial), or bypass it?
