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
- Operator auth handler: `functions/operator/auth.js` → POST `/operator/auth` (validates `x-operator-key`, issues Bearer session token stored in OPERATOR_SESSIONS KV)
- Operator token verification: `functions/operator/_verifyToken.js` → shared `verifyOperatorToken(request, env)` — import and call first in every operator handler
- Operator submissions: `functions/operator/submissions.js` → GET `/operator/submissions` (filter + paginate onboarding records; verifyOperatorToken first)
- Operator developer (single): `functions/operator/developer.js` → GET `/operator/developer?ref=VLP-xxx` + PATCH `/operator/developer` (full record + skills reshape on GET; immutable fields enforced on PATCH)
- Operator developers (list): `functions/operator/developers.js` → GET `/operator/developers` (lightweight list: ref_number, full_name, status, publish_profile only)
- Operator post handler: `functions/operator/post.js` → POST `/operator/post` (targeted job post to a developer record; updates nextNotificationDue per cronSchedule)
- Operator jobs handler: `functions/operator/jobs.js` → GET/POST/PATCH `/operator/jobs` (job post CRUD; job stored in R2 `job-posts/{jobId}.json`)
- Operator bulk email handler: `functions/operator/bulk-email.js` → POST `/operator/bulk-email` (filter-based bulk email via Gmail API; dry-run supported; receipt written to R2)
- Operator analytics handler: `functions/operator/analytics.js` → GET `/operator/analytics` (submission counts across 4 R2 collections + Cloudflare Analytics API page views; time-bucketed metrics; CF_API_TOKEN + CF_ZONE_ID required)
- Operator messages handler: `functions/operator/messages.js` → POST `/operator/messages` (send outbound message to developer; writes to R2 + sends email) + GET `/operator/messages?ref=VLP-xxx` (fetch full thread)
- Operator tickets list: `functions/operator/tickets/index.js` → GET `/operator/tickets` (list support tickets from support-records/ with optional ?status filter; includes replyCount)
- Operator ticket reply: `functions/operator/tickets/[ticketId]/reply.js` → POST `/operator/tickets/{ticketId}/reply` (append reply to ticket; update status to in_progress; send email to submitter)
- Operator canned responses: `functions/operator/canned-responses.js` → GET `/operator/canned-responses` (list with optional ?userType filter) + POST (create new template; isDefault:false)
- Operator canned response PATCH/DELETE: `functions/operator/canned-responses/[templateId].js` → PATCH `/operator/canned-responses/{templateId}` (edit mutable fields) + DELETE (isDefault guard — cannot delete default templates)
- Canned response seed script: `scripts/seed-canned-responses.js` → writes 11 isDefault:true templates (4 developer + 4 client + 3 legacy migrated) to R2 via Cloudflare REST API
- Developer match intake handler: `functions/forms/find-developers.js` → POST `/forms/developer-match-intake` (no auth; writes to `developer-match-requests/{eventId}.json` + receipt to `receipts/form/{eventId}.json`)
- Cron job match handler: `functions/cron/job-match.js` → POST `/cron/job-match` (x-cron-secret auth — NOT operator Bearer; matches active/published developers to a job by skill; sends bulk email via Resend; updates nextNotificationDue per cronSchedule; writes run record + receipt to R2; KV dedupe in OPERATOR_SESSIONS)
- Onboarding status handler: `functions/forms/onboarding/status.js` → GET `/forms/onboarding/status?referenceId=VLP-xxx` (no auth — public; returns status + lastUpdated only; R2 prefix scan by ref_number)

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

## Email Routing

All email dispatch imports from `functions/_shared/email.js` only. Never call `gmail.js` or Resend directly from a handler.

| Flow | Service | Function | Handler |
|---|---|---|---|
| Onboarding confirmation to user | Gmail API | `sendTransactionalEmail` | functions/forms/onboarding.js |
| Operator post notification to developer | Gmail API | `sendTransactionalEmail` | functions/operator/post.js |
| Support ticket reply to submitter | Gmail API | `sendTransactionalEmail` | functions/operator/messages.js |
| Cron job match notification to developer | Resend | `sendBulkEmail` | functions/cron/job-match.js |
| Bulk email dispatch | Resend | `sendBulkEmail` | functions/operator/bulk-email.js |

- Transactional (1 recipient) → Gmail API via `sendTransactionalEmail`
- Bulk (multiple recipients) → Resend batch API via `sendBulkEmail` (batches of 50)
- `EMAIL_FROM = team@virtuallaunch.pro` (set in `[vars]` in `wrangler.toml`)
- `RESEND_API_KEY` — set via `wrangler secret put RESEND_API_KEY`
- Email failure in any handler must never cause a non-200 response

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

### 2026-03-25 — Shared header/footer partials
- New files:
  - `public/partials/header.html` — standalone site header partial (sticky nav with logo, nav links, Operator Login + Get Started CTAs)
  - `public/partials/footer.html` — standalone site footer partial (4-col grid; Product column populated dynamically by partials-loader.js)
  - `public/js/partials-loader.js` — async IIFE; fetches both partials via `fetch('/partials/header.html')` and `fetch('/partials/footer.html')`; replaces `<div id="site-header">` and `<div id="site-footer">` placeholders using `outerHTML`; populates `#footer-product-links` with per-page links based on `window.location.pathname`
- HTML pages updated (all in `public/`):
  - `index.html`, `reviews.html`, `support.html`, `onboarding.html`, `success.html`, `available.html`, `operator.html`, `find-developers.html`
  - Each: existing `<header>...</header>` → `<div id="site-header"></div>`; existing site `<footer>...</footer>` → `<div id="site-footer"></div>`; `<script src="/js/partials-loader.js" defer></script>` added before `</body>`
  - `find-developers.html` edge case: contains a `<footer>` element used as a content section wrapper (timeline + script block closes at line 1582). Only the inner site footer (4-column grid at ~line 1178) was replaced; outer wrapper preserved.
  - `operator.html`: custom operator header and minimal footer replaced with standard placeholders — site-wide nav now injected uniformly
- Registry updates: `contracts/registry.json` — added `sharedAssets` array with 3 entries; `.claude/registry.json` — added 3 new files to `frontend.additionalFiles`

### 2026-03-25 — Fix footer visual inconsistency on support.html
- Files modified: `public/support.html`
- Issue 1 — Missing top border divider:
  - Root cause: `<main class="flex-1 ... overflow-auto">` created an inner scroll container.
    With `#app { min-h-screen; flex flex-col }` and `main { flex-1 }`, the main fills the
    viewport. The section (Final CTA) and footer outside `<main>` relied on body-level
    scrolling but the inner scroll container confused the layout and obscured the footer's
    `border-t border-slate-800/50` divider.
  - Fix: Removed `overflow-auto` from `<main>` — page now scrolls as a whole (body-level),
    consistent with onboarding.html which has no `overflow-auto` on its `<main>`.
- Issue 2 — Thinner/lighter footer text:
  - Root cause: CSS rule `#app, #app > *, main, main > section, header, footer { position: relative; z-index: 1; }`
    applied `z-index: 1` to the footer element (via both `footer` and `#app > *` selectors).
    In Blink/WebKit, `z-index: 1` forces GPU compositing on the element; composited layers
    disable subpixel antialiasing for text, causing it to appear thinner and lighter.
  - Fix: Added scoped CSS override `footer, #app > footer { z-index: auto; }` after the
    existing rule. Higher specificity (`#app > footer` = `(1,0,1)`) overrides both `#app > *`
    = `(1,0,0)` and `footer` = `(0,0,1)`. Footer keeps `position: relative` for layering
    above `site-bg-effects` (DOM order preserves correct paint order at `z-index: auto`).
- Verified: `<body class="h-full bg-slate-950 text-slate-100">` matches onboarding.html and
  index.html — no change needed to body structure.
- partials/footer.html and partials-loader.js were NOT modified.

### 2026-03-25 — Fix footer visual inconsistency on find-developers.html
- Files modified: `public/find-developers.html`
- Same root causes as the support.html fix (same CSS rule pattern), but different page structure:
  - find-developers.html has NO `<main>` element and NO `overflow-auto`, so Fix 1 from
    support.html (removing `overflow-auto` from `<main>`) does not apply here.
  - The outer `<footer class="border-t border-slate-800/50 bg-slate-950">` at line 1075 is
    a direct child of `#app` and acts as the "How Your Project Moves Forward" timeline wrapper.
    The `#site-footer` placeholder is nested inside this outer footer; after injection the
    site footer partial becomes a nested `<footer>` inside `<footer>`.
- Issue — Thinner/lighter footer text (and border rendering affected by compositing):
  - Root cause: Same as support.html — CSS rule `#app, #app > *, main, main > section, header, footer
    { position: relative; z-index: 1; }` applies `z-index: 1` to all `footer` elements (outer
    and injected inner) via both the `footer` and `#app > *` selectors, forcing GPU compositing
    and disabling subpixel antialiasing on text.
  - Fix: Added scoped CSS override `footer, #app > footer { z-index: auto; }` after the existing
    rule. Covers both the outer footer (`#app > footer`, specificity `(1,0,1)`) and the nested
    injected footer (`footer`, specificity `(0,0,1)` — wins by source order).
- partials/footer.html and partials-loader.js were NOT modified.

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

### 2026-03-25 — Implement POST /operator/auth + verifyOperatorToken utility
- New files:
  - `functions/operator/auth.js` — POST `/operator/auth` Pages Function handler
    - Validates `x-operator-key` header against `OPERATOR_KEY` env var
    - Parses JSON body; requires `eventId` string field
    - Deduplication via `operator-dedupe:{eventId}` KV key (TTL: 28800s)
    - Generates session token with `crypto.randomUUID()`
    - Writes `operator-session:{token}` to OPERATOR_SESSIONS KV (TTL: 28800s)
    - Returns 201 on new session, 200 on dedup hit, 401 on bad key, 400 on validation fail, 405 on wrong method
  - `functions/operator/_verifyToken.js` — shared `verifyOperatorToken(request, env)` utility
    - Extracts Bearer token from `Authorization` header
    - Looks up `operator-session:{token}` in OPERATOR_SESSIONS KV
    - Checks `expiresAt`; deletes expired key and returns `{ valid: false, error: "token_expired" }`
    - Returns `{ valid: true, token, eventId }` on success
- Updated: `wrangler.toml` — added `[[kv_namespaces]]` block for OPERATOR_SESSIONS (id left empty; must be created in Cloudflare dashboard)
- Updated: `contracts/registry.json` — added `handlerPath` and `handlerStatus` to operator-auth.json entry
- Updated: `.claude/CLAUDE.md` — added Key Files entries and this audit log entry
- FLAGS: OPERATOR_SESSIONS KV namespace ID must be created in Cloudflare dashboard and filled into `wrangler.toml`

### 2026-03-25 — Implement Operator Post, Jobs, and Bulk Email Handlers
- Files rewritten/created (post.js and jobs.js were prior stubs using old x-operator-key auth):
  - `functions/operator/post.js` — POST `/operator/post`
    - `verifyOperatorToken` first (import from `./_verifyToken.js`)
    - Required: eventId, ref_number, jobTitle, jobDescription; optional: jobId
    - Dedupe key: `operator-dedupe:post:{eventId}` in OPERATOR_SESSIONS KV (TTL 86400s)
    - Developer record existence verified in R2 (`onboarding-records/{ref_number}.json`)
    - Post written to R2: `operator-posts/{ref_number}/{eventId}.json`
    - Developer's `nextNotificationDue` updated based on their `cronSchedule` (3/7/14 days ISO string)
    - Returns: `{ ok, eventId, ref_number, notificationStatus: "queued" }`
  - `functions/operator/jobs.js` — GET/POST/PATCH `/operator/jobs`
    - `verifyOperatorToken` first in all three branches
    - GET: lists R2 `job-posts/` prefix, optional `?status=open|closed` filter
    - POST: creates job record at `job-posts/{eventId}.json`; dedupe `operator-dedupe:job:{eventId}`
    - PATCH: extracts jobId from URL path; immutable fields: jobId, eventId, createdAt; updates updatedAt
    - All three branches use `onRequest` catch-all with method routing
    - R2 binding: `ONBOARDING_R2`
  - `functions/operator/bulk-email.js` — POST `/operator/bulk-email` (new file)
    - `verifyOperatorToken` first
    - Required: eventId, subject; body or templateId required (400 if neither)
    - Dedupe key: `operator-dedupe:bulk-email:{eventId}` (TTL 86400s)
    - Template resolution: fetches `operator-canned-responses/{templateId}.json` from R2; uses template
      subject/body as fallback (payload values take precedence)
    - Recipient filter: status, cronSchedule, publish (boolean on publish_profile), skill (record[skill] >= 1)
    - Email list deduplicated by address
    - Dry run: writes receipt with dryRun:true, returns recipientCount, does NOT dispatch
    - Live send: iterates recipients via `sendEmail` from `functions/_shared/gmail.js`; non-fatal errors logged
    - Receipt written to R2: `receipts/operator/bulk-email/{eventId}.json`
    - Email service: Gmail API via `functions/_shared/gmail.js` (GOOGLE_PRIVATE_KEY, GOOGLE_CLIENT_EMAIL)
- Updated `contracts/registry.json`: added handlerPath + handlerStatus: "implemented" to all three entries
- Updated `.claude/CLAUDE.md`: added Key Files entries and this audit log entry

### 2026-03-25 — Implement Unified Email Utility (Gmail API + Resend)
- New files:
  - `functions/_shared/email.js` — unified email dispatch
    - `sendTransactionalEmail(env, { to, subject, html, text, replyTo })` — wraps gmail.js `sendEmail`; catches errors; returns `{ ok, messageId }` or `{ ok: false, error }`; never throws
    - `sendBulkEmail(env, { recipients, subject, html, text })` — Resend batch API; 50 per batch; per-batch errors collected, not thrown; returns `{ ok, sent, failed, errors }`
    - `sendEmailDryRun(recipients)` — no API call; returns `{ ok, recipientCount, dryRun: true, sent: false }`
  - `functions/_shared/emailTemplates.js` — HTML + plain text templates (inline styles, max-width 600px)
    - `onboardingConfirmation({ full_name, ref_number, status })`
    - `operatorPostNotification({ full_name, jobTitle, jobDescription, postedAt })`
    - `cronMatchNotification({ full_name, jobTitle, jobDescription, jobId })`
    - `supportTicketReply({ clientRef, subject, replyBody })`
    - `bulkEmailTemplate({ full_name, subject, body })`
- Updated `functions/operator/bulk-email.js`:
  - Removed direct `sendEmail` from `gmail.js` import
  - Added imports: `sendBulkEmail`, `sendEmailDryRun` from `email.js`; `bulkEmailTemplate` from `emailTemplates.js`
  - Dry run now uses `sendEmailDryRun`
  - Live send now uses `bulkEmailTemplate` + `sendBulkEmail` (recipients mapped to email strings)
  - Receipt updated to include `sent` + `failed` counts from result
- Updated `functions/operator/post.js`:
  - Added imports: `sendTransactionalEmail` from `email.js`; `operatorPostNotification` from `emailTemplates.js`
  - After R2 write + nextNotificationDue update: sends email via `sendTransactionalEmail`
  - Updates `postRecord.notificationStatus` to `'sent'` or `'failed'`; writes updated record back to R2
  - Email failure never causes non-200 response (entire block wrapped in try/catch)
- Updated `wrangler.toml`: added `EMAIL_FROM = "team@virtuallaunch.pro"` to `[vars]`; added secret comments for RESEND_API_KEY, GOOGLE_PRIVATE_KEY, GOOGLE_CLIENT_EMAIL
- Updated `.claude/registry.json`: added `sharedAssets` array with two entries
- Updated `.claude/CLAUDE.md`: added Email Routing section; this audit log entry
- Gmail API pattern: gmail.js `sendEmail(env, toEmail, subject, bodyText)` — plain text; throws on failure

### 2026-03-25 — Implement Operator Submissions + Developers Handlers
- Files rewritten (all three were prior stubs importing a non-existent `../_shared/auth.js`):
  - `functions/operator/submissions.js` — GET /operator/submissions
    - `verifyOperatorToken` called first (import from `./_verifyToken.js`)
    - Filters: status (enum), type (enum), skill (skill_* field >= 1), publish (boolean), cronSchedule (enum)
    - Pagination: page + limit (default 25, max 100); offset-based slice
    - R2 pagination handled via `list.truncated` + `list.cursor` loop
    - Response shape matches `contracts/operator-submissions.json`
    - CORS headers preserved (existing pattern in operator handler directory)
  - `functions/operator/developer.js` — GET + PATCH /operator/developer
    - `verifyOperatorToken` called first in both export handlers
    - GET: direct key lookup (`onboarding-records/${ref}.json`; ref == eventId)
    - GET: skill_* keys extracted from flat record and nested under `skills` object in response
    - GET: response shape matches `contracts/operator-developers.json` success shape
    - PATCH: parses JSON body; requires `ref_number`; 404 if not found
    - PATCH: strips and restores immutable fields (ref_number, email, eventId, createdAt) after merge
    - PATCH: writes merged record back to R2 at same key; returns `{ ok, ref_number, updatedAt }`
  - `functions/operator/developers.js` — GET /operator/developers
    - `verifyOperatorToken` called first
    - Optional filters: status, publish (boolean)
    - R2 pagination handled
    - Returns lightweight shape only: ref_number, full_name, status, publish_profile
    - Full records never returned
- Updated `contracts/registry.json`:
  - operator-submissions.json entry: added `handlerPath`, `handlerStatus: "implemented"`
  - operator-developers.json entry: added `handlerPath`, `handlerStatus: "implemented"`, `additionalHandlers`
- Updated `CLAUDE.md` Key Files — added three handler entries
- Note: existing stubs imported `verifyToken` from `'../_shared/auth.js'` — that file does not exist in this repo.
  All three handlers now use `verifyOperatorToken` from `./_verifyToken.js` as required.

### 2026-03-25 — Implement Analytics, Messages, Tickets, and Canned Responses handlers
- Files rewritten/created:
  - `functions/operator/analytics.js` — GET `/operator/analytics`
    - Rewrote old stub (imported non-existent `../_shared/auth.js`, used stale `dashboard-records/` prefix)
    - `verifyOperatorToken` first
    - Parallel R2 prefix scans: `onboarding-records/`, `find-developer-records/`, `support-records/`, `review-records/`
    - Date window filter (default: last 30 days) applied to `createdAt`/`submittedAt` field
    - Time series bucketed by `day`, `week` (ISO week), or `month`
    - Cloudflare Analytics GraphQL API call for page view data; graceful fallback to `{ data: null, error: "unavailable" }` on any error
    - Response shape matches `contracts/operator-analytics.json > response.success`
    - Required new env vars: `CF_API_TOKEN` (secret), `CF_ZONE_ID` (var)
  - `functions/operator/messages.js` — POST + GET `/operator/messages`
    - POST: validate `eventId`, `ref_number`, `subject`, `body`; dedupe `operator-dedupe:message:{eventId}` (TTL 86400s)
    - POST: developer record lookup in R2; write message to `operator-messages/{ref_number}/{eventId}.json`; write receipt to `receipts/operator/messages/{eventId}.json`
    - POST: email via `sendTransactionalEmail` using `supportTicketReply` template; catch failure silently
    - GET: list all messages at prefix `operator-messages/{ref}/`; sort by `sentAt`; return `{ ok, ref_number, messages }`
  - `functions/operator/tickets/index.js` — GET `/operator/tickets`
    - `verifyOperatorToken` first
    - Lists `support-records/` prefix; filters to top-level `.json` files only (skips reply sub-keys)
    - Optional `?status` filter; fetches reply count per ticket via separate prefix count
    - Returns `{ ok, results: [{ ticketId, clientRef, subject, status, submittedAt, replyCount }] }`
  - `functions/operator/tickets/[ticketId]/reply.js` — POST `/operator/tickets/{ticketId}/reply`
    - `verifyOperatorToken` first; `ticketId` from `context.params.ticketId`
    - Required: `eventId`, `body`; optional: `templateId`
    - Fetches ticket from `support-records/{ticketId}.json`; 404 if not found
    - Writes reply to `support-records/{ticketId}/replies/{eventId}.json`
    - Updates ticket `status` to `in_progress` if currently `open`; writes updated record back to R2
    - Sends reply email via `sendTransactionalEmail` using `supportTicketReply` template; catches failure silently
    - Returns `{ ok, ticketId, eventId, repliedAt }`
  - `functions/operator/canned-responses.js` — GET + POST `/operator/canned-responses`
    - GET: lists `operator-canned-responses/` prefix; optional `?userType` filter; returns `{ ok, templates: [...] }`
    - POST: validates `eventId`, `userType`, `label`, `subject`, `body`; dedupe `operator-dedupe:canned:{eventId}` (TTL 86400s)
    - POST: writes to `operator-canned-responses/{eventId}.json` with `isDefault: false`
    - POST: returns `{ ok, templateId, eventId }` 201
  - `functions/operator/canned-responses/[templateId].js` — PATCH + DELETE `/operator/canned-responses/{templateId}`
    - `templateId` from `context.params.templateId`
    - PATCH: fetches existing; merges mutable fields (`label`, `subject`, `body`, `userType`); updates `updatedAt`; writes back
    - DELETE: fetches existing; guards `isDefault === true` → 403 `{ ok: false, error: "protected" }`; deletes R2 object
  - `scripts/seed-canned-responses.js` — seed script for 8 default templates (4 developer + 4 client)
    - `isDefault: true` on all — protected from DELETE
    - Uses Cloudflare R2 REST API (`PUT /accounts/{id}/r2/buckets/{bucket}/objects/{key}`)
    - Run: `CLOUDFLARE_ACCOUNT_ID=<id> CLOUDFLARE_API_TOKEN=<token> node scripts/seed-canned-responses.js`
- Modified `functions/_shared/gmail.js`:
  - Added optional `html` parameter to `sendEmail(env, toEmail, subject, bodyText, html)`
  - If `html` provided: builds `multipart/alternative` MIME message via new `buildRawEmailHtml()` function
  - If `html` absent: existing `text/plain` path unchanged
  - `buildRawEmailHtml(fromEmail, fromName, toEmail, subject, htmlBody, textFallback)` — exported helper
- Modified `functions/_shared/email.js`:
  - `sendTransactionalEmail` now passes `html` as 5th arg to `sendEmail` so HTML templates render correctly
- Updated `wrangler.toml`:
  - Added `CF_ZONE_ID = ""` to `[vars]` with dashboard instruction comment
  - Added `CF_API_TOKEN` secret comment (Analytics:Read permission required)
- Updated `contracts/registry.json`:
  - `operator-analytics.json` entry: added `handlerPath`, `handlerStatus: "implemented"`
  - `operator-messages.json` entry: added `handlerPath`, `handlerStatus: "implemented"`, `additionalHandlers`
  - `operator-canned-responses.json` entry: added `handlerPath`, `handlerStatus: "implemented"`, `additionalHandlers`
- Updated `.claude/CLAUDE.md` Key Files section — added 10 new handler entries
- FLAGS:
  - `CF_ZONE_ID` must be filled in `wrangler.toml` (found in Cloudflare dashboard → Overview)
  - `CF_API_TOKEN` must be set via `wrangler secret put CF_API_TOKEN` with Analytics:Read permission
  - Seed script requires `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` env vars at run time

### 2026-03-26 — Implement Cron Job Match + Onboarding Status Handlers
- New files:
  - `functions/cron/job-match.js` — POST `/cron/job-match`
    - Auth: `x-cron-secret` header against `CRON_SECRET` env var — NOT operator Bearer token
    - Required body fields: `eventId`, `jobId`; optional: `required_skills` (array), `notifyAll` (boolean)
    - KV dedupe: `cron-dedupe:{eventId}` in OPERATOR_SESSIONS (TTL 86400s)
    - Fetches job from `job-posts/{jobId}.json`; 404 if not found
    - Loads `required_skills` from payload (falls back to job record's `required_skills`)
    - Full R2 pagination loop for `onboarding-records/` prefix (handles >1000 records)
    - Filter: `status === 'active' && publish_profile === true`
    - Match: `notifyAll` bypasses skill filter; otherwise matches any dev with skill field >= 1
    - Per-record: updates `nextNotificationDue` (3/7/14 days ISO string) + `updatedAt` in R2 — wrapped in try/catch (non-fatal)
    - Bulk email: `sendBulkEmail` (Resend) with `cronMatchNotification` template — caught, non-fatal
    - Writes run record: `cron-job-match-runs/{eventId}.json` and receipt: `receipts/cron/job-match/{eventId}.json`
    - Response matches `contracts/cron-job-match.json` success shape
  - `functions/forms/onboarding/status.js` — GET `/forms/onboarding/status`
    - No auth required — public endpoint
    - Query param: `referenceId` (400 if missing)
    - R2 prefix scan of `onboarding-records/` — finds record where `ref_number === referenceId`
    - Returns `{ ok, referenceId, status, lastUpdated }` only — never full record
    - 404 `{ ok: false, error: "not_found" }` if no match
- Updated `wrangler.toml`:
  - Added `[triggers]` with `crons = ["0 9 * * 1"]` (every Monday 9am UTC)
  - Added `CRON_SECRET` secret comment
- Updated `contracts/registry.json`:
  - `cron-job-match.json` entry: added `handlerPath`, `handlerStatus: "implemented"`
  - `onboarding-status.json` entry: added `handlerPath`, `handlerStatus: "implemented"`
- Updated `.claude/CLAUDE.md` Key Files section — added 2 new handler entries
- clientReference.js endpoint: no change needed — already calls `/forms/onboarding/status`
- FLAGS:
  - `CRON_SECRET` not yet set — run: `wrangler secret put CRON_SECRET` (use a long random string, unrelated to OPERATOR_KEY)

### 2026-03-26 — Post-verification fixes: find-developers handler, reviews auth, email/profiles retirement

**Task 1 — Create missing handler: POST /forms/developer-match-intake**
- New file: `functions/forms/find-developers.js`
  - `onRequestPost` + `onRequestOptions` following onboarding.js pattern
  - Validates all 11 required fields from `contracts/find-developers.json` payload.required
  - Enum validation for projectType, budget, timeline, skillsPreference, experienceLevel
  - Dedupe via R2 receipt check: `receipts/form/{eventId}.json`
  - Writes receipt first, then canonical record to `developer-match-requests/{eventId}.json`
  - Email skipped — no template exists for this flow
- Updated `contracts/registry.json`: handlerPath + handlerStatus: "implemented"

**Task 2 — Fix contracts/reviews.json auth**
- `auth.required`: true → false
- `auth.type`: "session" → "none"
- `contract.version`: 1 → 2
- Updated `contracts/registry.json`: version 1 → 2, removed stale mismatch note

**Task 3 — Retire functions/operator/email.js**
- Added 3 named exports to `functions/_shared/emailTemplates.js`:
  - `consentPublishTemplate({ full_name, ref_number })` — subject + HTML + text migrated from buildConsentPublish()
  - `welcomeAboardTemplate({ full_name, ref_number })` — migrated from buildWelcomeAboard()
  - `clientMatchTemplate({ full_name, ref_number, job })` — migrated from buildClientMatch(); job is optional
- Appended 3 legacy default canned responses to `scripts/seed-canned-responses.js`:
  - `default-consent-publish`, `default-welcome-aboard`, `default-client-match`
  - All isDefault:true; body uses [developerName]/[developerRef] placeholders
  - Uses `templates.push(...legacyTemplates)` — safe to re-run, upsert semantics
- Updated `public/operator.html`:
  - Login flow now calls POST `/operator/auth` (x-operator-key header + { eventId } body)
  - Stores `data.token` in sessionStorage as `vlp_operator_token`
  - `keyApiFetch` now uses `Authorization: Bearer ${token}` for ALL operator endpoints
  - `/operator/email` fetch replaced with `/operator/bulk-email`
    - template string mapped to templateId (default-consent-publish / default-welcome-aboard / default-client-match)
    - eventId generated via crypto.randomUUID()
  - `loadProfiles()` now calls `/operator/submissions` (returns `data.results`)
  - `togglePublish()` now calls `PATCH /operator/developer` with `{ ref_number, publish_profile }`
  - `loadDevelopers()` now uses `keyApiFetch` (Bearer token) instead of direct fetch with x-operator-key
  - `showDashboard()` calls `loadProfiles()` on entry; no longer accepts profilesData param
  - `operatorKey` variable removed from state; `vlp_operator_key` sessionStorage key no longer written
- Deleted: `functions/operator/email.js`

**Task 4 — Retire functions/operator/profiles.js**
- All fetch('/operator/profiles') calls in operator.html migrated (covered by Task 3 operator.html update):
  - GET /operator/profiles → GET /operator/submissions
  - PATCH /operator/profiles → PATCH /operator/developer
  - Login validation fetch → POST /operator/auth
- Auth header update covered all operator fetch calls in a single pass
- Deleted: `functions/operator/profiles.js`

**Note — consentPublish, welcomeAboard, clientMatch templates**
- Now in `emailTemplates.js` as named exports (code-driven use)
- Now in `scripts/seed-canned-responses.js` as default canned responses (R2 storage)
- Run `node scripts/seed-canned-responses.js` to write the 3 new templates to R2
  (Re-running is safe — uses upsert; existing templates are preserved)
