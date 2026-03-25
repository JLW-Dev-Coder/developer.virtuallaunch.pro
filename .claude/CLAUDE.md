# VirtualLaunch Developer — Claude Context

## Architecture Overview
- Frontend: Static HTML + Tailwind CSS, served via Cloudflare Pages (developers.virtuallaunch.pro)
- Backend: Cloudflare Workers (`workers/src/index.js`) + Cloudflare Pages Functions (`functions/forms/`)
- Storage: Cloudflare R2 bucket (`onboarding-records`)
- Runtime: workerd (Cloudflare); entrypoint declared in `wrangler.toml`
- Hosting: developers.virtuallaunch.pro

## Key Files
- Onboarding flow: `public/onboarding.html` (multi-step SPA: form-page → payment-page)
- Post-payment landing: `public/success.html` — served at `/success` (Cloudflare Pages Pretty URLs strips `.html`); polls `/forms/stripe/session-status` on load
- Onboarding Pages Function: `functions/forms/onboarding.js` (GET / POST / PATCH)
- Worker entry (status + onboarding): `workers/src/index.js`
- Developer listing: `functions/forms/developers.js` + `public/js/developers.js`
- Support status endpoint: `workers/src/index.js` → GET `/forms/support/status?clientRef=VLP-xxx`
- Stripe checkout session creator: `functions/forms/stripe/create-session.js` (POST)
- Stripe webhook handler: `functions/forms/stripe/webhook.js` (POST)
- Session status endpoint: `functions/forms/stripe/session-status.js` (GET)

## Stripe Integration
- Webhook endpoint: https://api.virtuallaunch.pro/v1/webhooks/stripe
- Webhook secret: stored as env var STRIPE_WEBHOOK_SECRET — never hardcode
- Listening events: see registry.json > stripe.webhookEvents
- Success redirect URL: https://developers.virtuallaunch.pro/success.html?session_id={CHECKOUT_SESSION_ID}
- Both Free and $2.99 plans go through Stripe Checkout Sessions (not Payment Links)
- Stripe lives in Pages Functions in this repo (`functions/forms/stripe/`)
- Stripe SDK version: 20.4.1

## Payment State Machine
States: plan-selection → processing → completed | error
- State is never derived from redirect URL params alone
- Completed state requires webhook confirmation (`paymentStatus: "completed"` + `webhookConfirmedAt`)
- `vl_payment_state` key in sessionStorage tracks current state
- `success.html` polls `/forms/stripe/session-status?session_id=...` every 2s, 30s timeout
- See registry.json > paymentStates for full contract

## sessionStorage and Stripe Checkout
sessionStorage does NOT survive cross-origin navigation. Stripe Checkout redirects to checkout.stripe.com
and back — any sessionStorage written on onboarding.html (vlp_ref, vlp_email, etc.) will be empty when
success.html loads. All data needed on success.html must be read from the session-status endpoint response,
not from sessionStorage. The session-status endpoint returns `vlp_ref` in the response body; success.html
writes it back to sessionStorage only after the poll confirms `status: "completed"`.

## Environment Variables

| Key                        | Required | Location              | Purpose                                  |
|----------------------------|----------|-----------------------|------------------------------------------|
| STRIPE_SECRET_KEY          | yes      | Cloudflare dashboard  | Authenticate Stripe API calls            |
| STRIPE_WEBHOOK_SECRET      | yes      | Cloudflare dashboard  | Verify webhook signatures                |
| STRIPE_PRICE_FREE          | yes      | Cloudflare dashboard  | Free plan price ID                       |
| STRIPE_PRICE_PAID          | yes      | Cloudflare dashboard  | $2.99 recurring price ID                 |
| STRIPE_INTERNAL_COUPON_ID  | no       | Cloudflare dashboard  | 100% off coupon for internal testing     |

## Internal Testing

To test the paid plan at $0 cost using the internal 100% off coupon:
1. Open the browser DevTools console on onboarding.html
2. Run: `sessionStorage.setItem('vlp_internal', 'true')`
3. Click the paid plan card — the Checkout Session will include the 100% off coupon

The `vlp_internal` flag is read from sessionStorage only. It is never derived from URL params.
The coupon ID is never exposed to the client — it is read server-side from `STRIPE_INTERNAL_COUPON_ID`.
If `STRIPE_INTERNAL_COUPON_ID` is not set in the environment, the flag is silently ignored.
The coupon is never applied to the free plan.

## Self-Check Rules (run before every change)
1. Never modify webhook endpoint, secret, or event list
2. Never derive payment state from client-side redirect alone
3. After any backend change, verify the status polling endpoint still
   returns the shape in registry.json > backend.sessionStatusResponseShape
4. After any frontend change, verify all four payment states render
   without JS errors
5. If a required file is missing, stop and report — do not invent a substitute

## Audit Log

### 2026-03-25 — Initial audit
- Files read: .claude/settings.local.json, wrangler.toml, workers/src/index.js,
  functions/forms/onboarding.js, public/onboarding.html, public/success.html,
  public/js/developers.js, public/available.html (partial), contracts/registry.json,
  contracts/onboarding.json
- Nulls remaining at that time: Stripe webhook handler, session-status endpoint,
  Stripe SDK version, vl_payment_state sessionStorage key

### 2026-03-25 — Free plan fix + internal coupon support
- Changes:
  - Fixed `functions/forms/stripe/create-session.js`:
    - Removed `payment_method_collection` from free plan (mode: "payment") session config —
      Stripe does not allow this field on payment-mode sessions; was causing 500 in production
    - Improved Stripe catch block: logs `error.type`, `error.message`, `error.code`;
      returns `{ ok: false, error: "stripe_error", message: error.message }` to client
    - Added optional `internal` boolean field in request body; when `true` and
      `env.STRIPE_INTERNAL_COUPON_ID` is set, applies coupon to paid plan session only
  - Updated `public/onboarding.html` — `selectPlan` reads `vlp_internal` from sessionStorage;
    if `"true"`, includes `internal: true` in POST body to create-session
  - Updated `wrangler.toml` — added `STRIPE_INTERNAL_COUPON_ID` placeholder comment
  - Updated `.claude/registry.json` — added `STRIPE_INTERNAL_COUPON_ID` to env array
  - Updated `.claude/CLAUDE.md` — added env var row + "Internal Testing" section
- Root cause resolved: Stripe error "You can only set payment_method_collection if there are
  recurring prices" — `payment_method_collection: "if_required"` was set on `mode: "payment"`

### 2026-03-25 — Stripe Checkout + Webhook State Machine
- Changes:
  - Created `functions/forms/stripe/create-session.js` (POST /forms/stripe/create-session)
  - Created `functions/forms/stripe/webhook.js` (POST /forms/stripe/webhook)
  - Created `functions/forms/stripe/session-status.js` (GET /forms/stripe/session-status)
  - Updated `contracts/registry.json` — added stripeEndpoints array with 3 new entries
  - Updated `wrangler.toml` — added [vars] section with placeholder env var comments
  - Updated `public/onboarding.html` — selectPlan now calls create-session and redirects;
    processing/error states added; vl_payment_state tracked in sessionStorage
  - Updated `public/success.html` — polls session-status on load; full state machine
    (processing → completed | error | timeout)
  - Updated `.claude/CLAUDE.md` and `.claude/registry.json` — null fields resolved
  - Installed stripe npm package (v20.4.1)
- Files read during this task: contracts/prod1_v1.json, contracts/price1_v1.json,
  contracts/price2_v1.json, contracts/onboarding.json, contracts/registry.json,
  .claude/registry.json, .claude/CLAUDE.md, public/onboarding.html, public/success.html,
  wrangler.toml
- Open questions resolved:
  - Stripe lives in Pages Functions in this repo (not api.virtuallaunch.pro, not external service)
  - Checkout Sessions used — Payment Links retired from frontend use
  - vlp_ref passed via client_reference_id in Checkout Session; also in session.metadata.vlp_ref
  - Free plan: mode "payment", $0, payment_method_collection "if_required"
  - Paid plan: mode "subscription", $2.99/mo, payment_method_collection "always"
  - success.html polls session-status endpoint (not sessionStorage-only)
  - selectPlan('free') initiates Stripe Checkout (free $0 one_time, payment_method_collection: if_required)
- Nulls remaining: none — all fields resolved; see registry.json audit log for confirmation

### 2026-03-25 — Success page: reference number, double scroll, Cal.com embed
- Files modified: `public/success.html`, `.claude/CLAUDE.md`
- Changes:
  - Fix 1 — Reference number display: `vlp_ref` key confirmed by reading onboarding.html
    (set on form submit via `sessionStorage.setItem('vlp_ref', ...)`). Adjusted
    `renderPaymentState('completed')` to hide the entire ref section silently when
    `vlp_ref` is absent from sessionStorage — previously the section showed with "—"
  - Fix 2 — Double scroll (success.html only): removed `height: 100%` and `overflow-y: auto`
    from `html, body` style rule; removed `h-full` from `#app` div; removed `overflow-auto`
    from `<main>`. onboarding.html has no inner overflow-auto container — not affected
  - Fix 3 — Cal.com popup embed: replaced direct `href` on Schedule Your Call `<a>` tag
    with `data-cal-link`, `data-cal-namespace`, `data-cal-config` attributes; removed
    `href`, `target`, `rel` from the element; updated error-state selector from
    `a[href*="cal.com"]` to `[data-cal-link]`; added Cal.com embed script block before
    `</body>` on success.html only

### 2026-03-25 — Fix missing reference number on success page
- Root cause: sessionStorage does not survive Stripe Checkout cross-origin redirect —
  vlp_ref written in onboarding.html is empty when success.html loads
- Changes:
  - `functions/forms/stripe/session-status.js`: added `vlp_ref: vlp_ref || null` to
    Response.json in the single return path — `vlp_ref` already extracted from
    `session.client_reference_id` at line 24; R2 field name confirmed as `recordId`
    from contracts/onboarding.json (same value as eventId = vlp_ref)
  - `public/success.html`: poll function now passes `vlp_ref: data.vlp_ref || null`
    to `renderPaymentState`; writes vlp_ref back to sessionStorage only after
    status === "completed"; `renderPaymentState('completed')` reads vlp_ref from
    `opts_.vlp_ref` instead of `sessionStorage.getItem('vlp_ref')`
  - `.claude/registry.json`: added `vlp_ref: "string | null"` to sessionStatusResponseShape
  - `.claude/CLAUDE.md`: added sessionStorage/Stripe limitation note; updated Key Files
    to note /success Pretty URL behavior; added this audit log entry
- Fix 3 — /success vs /success.html: no _redirects or _routes.json found; Cloudflare
  Pages serves success.html at /success via its built-in Pretty URLs feature (strips .html)
  No routing change needed — noted in Key Files

### 2026-03-25 — Fix MIME errors, TypeError crash, and reference number display on success.html
- Files modified: `public/success.html`, `.claude/CLAUDE.md`
- Changes:
  - Bug 1 — Removed two broken `<script src="/_sdk/element_sdk.js">` and
    `<script src="/_sdk/data_sdk.js">` tags; neither file exists in the repo,
    causing MIME type errors and blocking script execution
  - Bug 2 — Guarded `window.elementSdk.init(...)` and `window.dataSdk.init(...)`
    with optional-chaining null checks (`if (window.elementSdk?.init)`) so the
    DOMContentLoaded handler no longer throws an Uncaught TypeError when the SDK
    globals are absent; the payment state machine and polling logic are untouched
  - Bug 3 — Added sessionStorage fallback in `renderPaymentState('completed')`:
    `opts_.vlp_ref || sessionStorage.getItem('vlp_ref') || null` so the reference
    number displays even if the poll response omits vlp_ref; "—" only shown when
    both sources are null
- Root cause of Bug 2: SDK script tags (Bug 1) loaded the HTML 404 page as text/html,
  leaving `window.elementSdk` and `window.dataSdk` undefined; `.init()` on undefined
  crashed before the payment polling block ran

### 2026-03-25 — Domain rename: developer → developers
- Changes:
  - Renamed all occurrences of `developer.virtuallaunch.pro` → `developers.virtuallaunch.pro`
  - Files updated: `functions/forms/stripe/create-session.js` (success_url, cancel_url),
    `contracts/price1_v1.json`, `contracts/price2_v1.json` (payment_link redirect url),
    `.claude/registry.json` (stripe.successRedirect),
    `.claude/CLAUDE.md` (Architecture Overview, Hosting, Stripe Integration, audit log),
    `.claude/settings.local.json` (Bash permission file path),
    `README.md` (repository name, Stripe config URL),
    `package-lock.json` (name field)
  - No logic, routing behavior, or configuration changed beyond the domain string itself
  - `node_modules/.package-lock.json` skipped — auto-generated file
