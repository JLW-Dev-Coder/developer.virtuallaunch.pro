# DVLP — Claude Context

- **Repo:** `developers.virtuallaunch.pro`
- **Product:** Developers VLP (DVLP)
- **Domain:** developers.virtuallaunch.pro
- **Last updated:** 2026-04-04
- **Purpose:** Freelancer/client matching marketplace — developer onboarding, pricing, operator dashboard

---

## 1. System Definition

**What it is:** Next.js 15 static frontend for the VirtualLaunch developer marketplace. Renders all public pages (landing, onboarding, pricing, reviews, find-developers) and the authenticated operator dashboard.

**What it is NOT:** This repo contains NO backend logic, NO API handlers, NO Cloudflare Workers, NO Pages Functions. All backend routes were migrated to the VLP Worker at `api.virtuallaunch.pro`.

**Audience:** Freelance developers seeking U.S. clients, businesses seeking development talent, site operators managing the marketplace.

**Stack:**
- Framework: Next.js 15.1.12 (App Router)
- Output: Static export (`output: 'export'` → `out/`)
- Hosting: Cloudflare Pages (`pages_build_output_dir = "out"`)
- Styling: Custom CSS (`globals.css`) + CSS Modules per page/component
- Font: Sora (Google Fonts)
- API client: `lib/api.ts` → all calls to `https://api.virtuallaunch.pro`
- Auth: Cookie-based sessions via `credentials: 'include'`
- Bindings: R2 (`onboarding-records`), KV (`OPERATOR_SESSIONS`) — declared in `wrangler.toml` for Pages

**Backend dependency:** VLP Worker (`api.virtuallaunch.pro`) owns all API routes. This repo calls them via `lib/api.ts`.

---

## 2. Hard Constraints

1. **No backend in this repo** — all API logic lives in the VLP Worker
2. Never create `functions/`, `workers/`, or Pages Function files
3. Never hardcode API keys, webhook secrets, or Stripe keys
4. Never derive payment state from client-side redirect alone
5. Never invent endpoints — only call routes defined in `lib/api.ts`
6. `wrangler.toml` is Pages-only config — no Worker name, no `main` field
7. Do not modify `contracts/` — these are reference-only copies

---

## 3. Terminology

| Canonical | Forbidden | Notes |
|-----------|-----------|-------|
| DVLP | "the dev site" | Product abbreviation |
| VLP Worker | "the backend", "the API" | Always specify by name |
| developer | "freelancer", "contractor" | Platform term |
| operator | "admin" | Role managing the marketplace |
| onboarding record | "signup", "registration" | R2 object in `onboarding-records/` |
| ref_number | "reference ID", "client ref" | Unique per onboarding record |

---

## 4. Repo Structure

```
app/                    # Next.js App Router pages
  layout.tsx            # Root layout (Sora font, metadata)
  globals.css           # Global styles, design tokens, animations
  page.tsx              # Landing page (/)
  affiliate/            # /affiliate — affiliate dashboard
  developers/           # /developers — public dev listing
  find-developers/      # /find-developers — client intake form
  onboarding/           # /onboarding — developer signup + Stripe
  operator/             # /operator — authenticated admin dashboard
  pricing/              # /pricing — plan comparison
  reviews/              # /reviews — public testimonials
  sign-in/              # /sign-in — magic link auth
  success/              # /success — post-checkout confirmation
components/             # Shared React components
  Header.tsx / .css     # Site header
  Footer.tsx / .css     # Site footer
  BackgroundEffects.tsx # Animated background blobs/grid
  AuthGuard.tsx         # Session-gated wrapper
  AdminGuard.tsx        # Operator-role wrapper
lib/
  api.ts                # Centralized API client (all fetch calls)
contracts/              # Reference copies of API contracts (read-only)
scripts/                # Operational scripts (seed, backfill, dedupe)
public/                 # Static assets (_headers, partials, contracts)
out/                    # Build output (static export)
wrangler.toml           # Cloudflare Pages config (R2 + KV bindings)
.claude/                # Claude context, canonicals, registry
```

---

## 5. Data Contracts

Contracts in `contracts/` are **reference copies** — the VLP Worker is the source of truth.

Key contracts:
- `onboarding.json` — developer signup payload and R2 shape
- `registry.json` — full endpoint registry with handler status
- `reviews.json` — public review submission shape
- `find-developers.json` — client intake form payload
- `operator-*.json` — operator dashboard endpoint shapes

---

## 6. API Integration

All API calls go through [lib/api.ts](lib/api.ts):
- **Base URL:** `https://api.virtuallaunch.pro`
- **Auth:** `credentials: 'include'` (cookie-based sessions)
- **Session check:** `getSession()` → `/v1/auth/session`
- **Error handling:** `ApiError` class with status, message, body

Route namespace: `/v1/dvlp/*` for all DVLP-specific endpoints.

Exception: [app/sign-in/page.tsx](app/sign-in/page.tsx) calls `/v1/auth/magic-link/request` directly.

---

## 7. Stripe / Payment Flow

- Checkout initiated from `/onboarding` via `createCheckout()` → VLP Worker
- Plans: Free ($0 one-time) and Paid ($2.99/mo subscription)
- After Stripe redirect, `/success` polls `getSessionStatus()` every 2s (30s timeout)
- Payment state machine: `plan-selection → processing → completed | error`
- `sessionStorage` does NOT survive Stripe cross-origin redirect — all data comes from API response
- Webhook confirmation required for `completed` state

---

## 8. Migration Status

| Item | Status |
|------|--------|
| Frontend | Next.js 15 App Router — complete |
| Backend | All routes ported to VLP Worker — complete |
| Pages Functions | Deleted (`functions/` removed) |
| Legacy Workers | Deleted (`workers/` removed) |
| Legacy HTML/JS | Deleted (`public/*.html`, `public/js/` removed) |
| Static export | `output: 'export'` → `out/` → Cloudflare Pages |

---

## 9. Environment / Config

Declared in `wrangler.toml`:

| Binding | Type | Purpose |
|---------|------|---------|
| ONBOARDING_R2 | R2 | `onboarding-records` bucket |
| OPERATOR_SESSIONS | KV | Session tokens, dedupe keys |
| EMAIL_FROM | var | `team@virtuallaunch.pro` |
| CF_ZONE_ID | var | Cloudflare zone for analytics |

Secrets (set via dashboard, not in repo): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CF_API_TOKEN`, `CRON_SECRET`, `RESEND_API_KEY`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_CLIENT_EMAIL`

---

## 10. Post-Task Requirements

After any change:
1. Run `npm run build` — must pass with zero errors
2. Verify no new `functions/` or `workers/` directories created
3. If touching `lib/api.ts`, verify all callers still type-check
4. If adding a page, confirm it appears in static export (`out/`)
5. If touching styles, verify `globals.css` tokens are used (not hardcoded colors)

---

## Post-Task Rules (mandatory after every task)

1. **Commit:** After completing any task, commit all changed files with a descriptive message. Never leave work uncommitted.
2. **Push:** After committing, run `git push origin main`.
3. **Deploy:** Push triggers Cloudflare Pages automatically for DVLP. No manual deploy needed.
4. **Report:** After commit+push, report the commit hash and any errors.

---

## 11. Related Systems

| System | Repo | Domain | Relationship |
|--------|------|--------|-------------|
| VLP Hub | virtuallaunch.pro | virtuallaunch.pro | Parent platform, owns Worker |
| VLP Worker | virtuallaunch.pro | api.virtuallaunch.pro | All DVLP API routes |
| TaxMonitor | taxmonitor.pro | taxmonitor.pro | Sibling product |
| Transcript | transcript.taxmonitor.pro | transcript.taxmonitor.pro | Sibling product |
| TaxTools | taxtools.taxmonitor.pro | taxtools.taxmonitor.pro | Sibling product |
