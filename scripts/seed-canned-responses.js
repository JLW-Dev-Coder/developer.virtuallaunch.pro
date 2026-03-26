#!/usr/bin/env node
// scripts/seed-canned-responses.js
// Writes 8 default canned response templates (4 developer + 4 client) to R2
// via the Cloudflare REST API using CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN
// from the process environment.
//
// Usage:
//   CLOUDFLARE_ACCOUNT_ID=<id> CLOUDFLARE_API_TOKEN=<token> node scripts/seed-canned-responses.js
//
// Requirements:
//   - CLOUDFLARE_ACCOUNT_ID  — your Cloudflare account ID
//   - CLOUDFLARE_API_TOKEN   — token with R2:Edit permission
//   - R2_BUCKET_NAME         — defaults to "onboarding-records"
//
// Each template written to: operator-canned-responses/{templateId}.json
// All templates have isDefault:true — they are protected from DELETE.

const ACCOUNT_ID  = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN   = process.env.CLOUDFLARE_API_TOKEN;
const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'onboarding-records';

if (!ACCOUNT_ID || !API_TOKEN) {
  console.error('Missing required env vars: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN');
  process.exit(1);
}

const now = new Date().toISOString();

// ── Template definitions ──────────────────────────────────────────────────────

const templates = [
  // ── Developer templates ───────────────────────────────────────────────────

  {
    templateId: 'default-dev-welcome',
    eventId:    'default-dev-welcome',
    userType:   'developer',
    label:      'Welcome',
    subject:    'Welcome to Virtual Launch Pro — Your Profile Is In',
    body: `Hi there,

Thank you for submitting your developer profile to Virtual Launch Pro. We've received your information and our team is reviewing your submission.

Here's what happens next:
1. Our team reviews your profile (typically within 1–2 business days)
2. If your profile is a match, we'll reach out with an opportunity
3. You can check your status anytime using your reference number

Keep an eye on your inbox — we'll be in touch soon!

The Virtual Launch Pro Team`,
    isDefault:  true,
    createdAt:  now,
    updatedAt:  now
  },

  {
    templateId: 'default-dev-profile-review',
    eventId:    'default-dev-profile-review',
    userType:   'developer',
    label:      'Profile Review',
    subject:    'Your Developer Profile Is Under Review',
    body: `Hi there,

We wanted to let you know that your Virtual Launch Pro developer profile is currently under review by our team.

We take care to match developers with the right opportunities, so this process may take a few business days. We appreciate your patience.

If you have any questions or need to update your profile information, please reply to this email with your reference number.

Thank you for being part of Virtual Launch Pro.

The Virtual Launch Pro Team`,
    isDefault:  true,
    createdAt:  now,
    updatedAt:  now
  },

  {
    templateId: 'default-dev-opportunity-match',
    eventId:    'default-dev-opportunity-match',
    userType:   'developer',
    label:      'Opportunity Match',
    subject:    'We Have a New Opportunity That Matches Your Profile',
    body: `Hi there,

Great news — we've found an opportunity that looks like a strong match for your skills and experience on Virtual Launch Pro.

We'll be following up shortly with the full details. In the meantime, feel free to review your profile and make sure your skills and availability are up to date.

We look forward to connecting you with this opportunity.

The Virtual Launch Pro Team`,
    isDefault:  true,
    createdAt:  now,
    updatedAt:  now
  },

  {
    templateId: 'default-dev-follow-up',
    eventId:    'default-dev-follow-up',
    userType:   'developer',
    label:      'Follow Up',
    subject:    'Checking In on Your Virtual Launch Pro Profile',
    body: `Hi there,

We noticed it's been a little while since your profile was last active on Virtual Launch Pro. We wanted to check in and see if you're still looking for new opportunities.

If you'd like to keep your profile active, no action is needed — we'll continue to match you with relevant opportunities as they come in.

If your situation has changed or you'd like to update your availability, please reply to this email or use your reference number to update your profile.

We're here to help whenever you're ready.

The Virtual Launch Pro Team`,
    isDefault:  true,
    createdAt:  now,
    updatedAt:  now
  },

  // ── Client templates ──────────────────────────────────────────────────────

  {
    templateId: 'default-client-welcome',
    eventId:    'default-client-welcome',
    userType:   'client',
    label:      'Welcome',
    subject:    'Welcome to Virtual Launch Pro — We\'ve Received Your Request',
    body: `Hi there,

Thank you for reaching out to Virtual Launch Pro. We've received your developer search request and our team is already getting to work.

Here's what to expect:
1. Our team reviews your project requirements (typically within 1 business day)
2. We search our developer network for qualified matches
3. We'll send you candidate profiles to review

We'll be in touch very soon with an update.

The Virtual Launch Pro Team`,
    isDefault:  true,
    createdAt:  now,
    updatedAt:  now
  },

  {
    templateId: 'default-client-search-update',
    eventId:    'default-client-search-update',
    userType:   'client',
    label:      'Search Update',
    subject:    'Update on Your Developer Search — Virtual Launch Pro',
    body: `Hi there,

We wanted to give you a quick update on your developer search with Virtual Launch Pro. Our team is actively reviewing our developer network to find the best match for your project requirements.

The search is progressing well. We expect to have candidate profiles ready for your review shortly.

If your requirements have changed or you have any additional details to share, please reply to this email — the more we know, the better we can match you.

Thank you for your patience.

The Virtual Launch Pro Team`,
    isDefault:  true,
    createdAt:  now,
    updatedAt:  now
  },

  {
    templateId: 'default-client-match-found',
    eventId:    'default-client-match-found',
    userType:   'client',
    label:      'Match Found',
    subject:    'We\'ve Found a Developer Match for Your Project',
    body: `Hi there,

Excellent news — we've identified a developer from our network who looks like a strong match for your project on Virtual Launch Pro.

We'll be following up shortly with their profile details and next steps for connecting you.

If you have any immediate questions or want to refine the requirements before we proceed, feel free to reply to this email.

We're excited to help move your project forward.

The Virtual Launch Pro Team`,
    isDefault:  true,
    createdAt:  now,
    updatedAt:  now
  },

  {
    templateId: 'default-client-follow-up',
    eventId:    'default-client-follow-up',
    userType:   'client',
    label:      'Follow Up',
    subject:    'Following Up on Your Virtual Launch Pro Request',
    body: `Hi there,

We wanted to follow up on your pending developer match request with Virtual Launch Pro. We noticed we haven't heard back and wanted to make sure everything is on track for your project.

If your project needs have changed, or if you'd like to adjust the skills or timeline requirements, please reply to this email and we'll update your search accordingly.

If you're still looking, we're still searching — just let us know you're ready to proceed and we'll pick up right where we left off.

The Virtual Launch Pro Team`,
    isDefault:  true,
    createdAt:  now,
    updatedAt:  now
  }
];

// ── Additional templates migrated from legacy operator/email.js ───────────────

const legacyTemplates = [
  {
    templateId: 'default-consent-publish',
    eventId:    'default-consent-publish',
    userType:   'developer',
    label:      'Consent to Publish',
    subject:    'Your Developer Profile on Virtual Launch Pro',
    body: `Dear [developerName],

To view your postings, go to the link below and enter your reference number [developerRef].

https://developers.virtuallaunch.pro/support.html

Thank you for trusting me with providing you with personalized vetted matches.

Don't forget to leave your review:
https://developers.virtuallaunch.pro/reviews.html

Your EA turned professional connector,
JLW
Virtual Launch Pro
developers.virtuallaunch.pro`,
    isDefault:  true,
    createdAt:  now,
    updatedAt:  now
  },

  {
    templateId: 'default-welcome-aboard',
    eventId:    'default-welcome-aboard',
    userType:   'developer',
    label:      'Welcome Aboard',
    subject:    "Welcome Aboard — You're Now Listed on Virtual Launch Pro",
    body: `Dear [developerName],

Congratulations, you have joined a membership that gets you vetted people who want to work with your specific skills. Look out in your email in the next three days for your next lists of client matches. To view your matches, go to the link below and enter your reference number [developerRef].

https://developers.virtuallaunch.pro/support.html

Thank you for trusting me with providing you with personalized vetted matches.

Don't forget to leave your review:
https://developers.virtuallaunch.pro/reviews.html

Let's get you matched.

Your EA turned professional connector,
JLW
Virtual Launch Pro
developers.virtuallaunch.pro`,
    isDefault:  true,
    createdAt:  now,
    updatedAt:  now
  },

  {
    templateId: 'default-client-match',
    eventId:    'default-client-match',
    userType:   'developer',
    label:      'Client Match',
    subject:    'New Client Matches Found for You',
    body: `Dear [developerName],

We found some client matches who are looking for the exact skills and expertise you offer. To view your matches, go to the link below and enter your reference number [developerRef].

https://developers.virtuallaunch.pro/support.html

Thank you for trusting me with personally vetted matches.

Don't forget to leave your review:
https://developers.virtuallaunch.pro/reviews.html

Let's get you matched.

Your EA turned professional connector,
JLW
Virtual Launch Pro
developers.virtuallaunch.pro`,
    isDefault:  true,
    createdAt:  now,
    updatedAt:  now
  }
];

// Merge all templates for seeding
templates.push(...legacyTemplates);

// ── R2 REST API upload ────────────────────────────────────────────────────────

async function putR2Object(key, value) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET_NAME}/objects/${key}`;

  const res = await fetch(url, {
    method:  'PUT',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type':  'application/json'
    },
    body: JSON.stringify(value)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`R2 PUT failed for ${key}: ${res.status} ${text}`);
  }
  return true;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Seeding ${templates.length} default canned response templates to R2 bucket "${BUCKET_NAME}"...\n`);

  let ok = 0;
  let failed = 0;

  for (const tpl of templates) {
    const key = `operator-canned-responses/${tpl.templateId}.json`;
    try {
      await putR2Object(key, tpl);
      console.log(`  ✓  ${key}`);
      ok++;
    } catch (err) {
      console.error(`  ✗  ${key} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. ${ok} written, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('Seed script error:', err.message);
  process.exit(1);
});
