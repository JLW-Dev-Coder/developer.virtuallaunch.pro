// functions/forms/onboarding.js
// Pages Function — handles POST /forms/onboarding
// Required bindings (Pages → Settings → Functions):
//   R2:     ONBOARDING_R2  → onboarding-records bucket
//   Secret: GOOGLE_PRIVATE_KEY → your Google service account private key
//   Secret: GOOGLE_CLIENT_EMAIL → your Google service account email

import { sendEmail } from '../_shared/gmail.js';

export async function onRequestPost({ request, env }) {
  const CORS = corsHeaders(request);

  try {
    const payload = await request.json();

    const requiredFields = ['confirmation', 'email', 'eventId', 'full_name'];
    for (const field of requiredFields) {
      if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
        return json({ ok: false, error: 'validation_failed' }, 400, CORS);
      }
    }

    if (payload.confirmation !== true) {
      return json({ ok: false, error: 'validation_failed' }, 400, CORS);
    }

    // Normalize publish_profile from checkbox/string values to boolean
    if (payload.publish_profile === 'on' || payload.publish_profile === 'true') {
      payload.publish_profile = true;
    } else if (payload.publish_profile === undefined || payload.publish_profile === null || payload.publish_profile === 'false' || payload.publish_profile === '') {
      payload.publish_profile = false;
    }

    // Validate publish_profile: must be present and boolean
    if (typeof payload.publish_profile !== 'boolean') {
      return json({ ok: false, error: 'validation_failed', field: 'publish_profile' }, 400, CORS);
    }

    const recordKey = `onboarding-records/${payload.eventId}.json`;

    const existing = await getRecord(env, recordKey);
    if (existing) {
      return json(
        { deduped: true, eventId: payload.eventId, ok: true, status: 'already_submitted' },
        200, CORS
      );
    }

    // Check for duplicate email using the lightweight email index
    const normalizedEmail = payload.email.toLowerCase().trim();
    const emailIndexKey   = `onboarding-email-index/${normalizedEmail}.json`;
    const existingIndex   = await getRecord(env, emailIndexKey);
    if (existingIndex) {
      return json({
        ok: false,
        error: 'duplicate_email',
        message: 'A profile already exists for this email address.',
        existingRef: existingIndex.eventId
      }, 409, CORS);
    }

    const now = new Date().toISOString();
    const record = {
      ...payload,
      createdAt: now,
      status: 'pending',
      updatedAt: now
    };

    // Compute nextNotificationDue when status = complete and cronSchedule is set
    if (payload.status === 'complete' && payload.cronSchedule) {
      const days = parseInt(payload.cronSchedule, 10);
      if (!isNaN(days)) {
        const due = new Date();
        due.setDate(due.getDate() + days);
        record.nextNotificationDue = due.toISOString();
      }
    }

    await putRecord(env, recordKey, record);

    // Write email index entry so future submissions from this address are rejected
    await putRecord(env, emailIndexKey, {
      eventId:    payload.eventId,
      ref_number: payload.eventId,
      createdAt:  now
    });

    // Send confirmation email (non-blocking — don't fail submission if email fails)
    try {
      await sendConfirmationEmail(env, payload.email, payload.full_name, payload.eventId);
    } catch (emailErr) {
      console.error('Email send failed (non-fatal):', emailErr);
    }

    return json({ eventId: payload.eventId, ok: true, status: 'pending' }, 200, CORS);

  } catch (err) {
    console.error(err);
    return json({ ok: false, error: 'invalid_json' }, 400, CORS);
  }
}

// PATCH /forms/onboarding — update existing record by ref_number
export async function onRequestPatch({ request, env }) {
  const CORS = {
    'Access-Control-Allow-Origin':  request.headers.get('Origin') || '*',
    'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age':       '86400'
  };

  try {
    const payload = await request.json();
    const { ref_number, ...updates } = payload;

    if (!ref_number) {
      return json({ ok: false, error: 'ref_number_required' }, 400, CORS);
    }

    const recordKey = `onboarding-records/${ref_number}.json`;
    const existing = await getRecord(env, recordKey);
    if (!existing) {
      return json({ ok: false, error: 'not_found' }, 404, CORS);
    }

    // Validate publish_profile if provided
    if ('publish_profile' in updates && typeof updates.publish_profile !== 'boolean') {
      return json({ ok: false, error: 'validation_failed', field: 'publish_profile' }, 400, CORS);
    }

    const now = new Date().toISOString();
    const updated = { ...existing, ...updates, updatedAt: now };

    // Compute nextNotificationDue when status = complete and cronSchedule is set
    if (updated.status === 'complete' && updated.cronSchedule) {
      const days = parseInt(updated.cronSchedule, 10);
      if (!isNaN(days)) {
        const due = new Date();
        due.setDate(due.getDate() + days);
        updated.nextNotificationDue = due.toISOString();
      }
    }

    await putRecord(env, recordKey, updated);

    // Task 2: include plan in response so frontend can call setPlanState
    return json({ ok: true, eventId: ref_number, status: updated.status || 'updated', plan: updated.plan || null }, 200, CORS);

  } catch (err) {
    console.error(err);
    return json({ ok: false, error: 'invalid_json' }, 400, CORS);
  }
}

// GET /forms/onboarding?ref=VLP-xxx — fetch record for form pre-fill
export async function onRequestGet({ request, env }) {
  const url    = new URL(request.url);
  const ref    = url.searchParams.get('ref');
  const origin = request.headers.get('Origin') || '*';
  const CORS   = {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age':       '86400'
  };

  if (!ref) return json({ ok: false, error: 'ref_required' }, 400, CORS);

  const recordKey = `onboarding-records/${ref}.json`;
  const record = await getRecord(env, recordKey);
  if (!record) return json({ ok: false, error: 'not_found' }, 404, CORS);

  // Return only safe-to-expose fields for form pre-fill
  return json({
    ok: true,
    data: {
      full_name:            record.full_name            || '',
      email:                record.email               || '',
      phone:                record.phone               || '',
      country:              record.country             || '',
      linkedin_url:         record.linkedin_url        || '',
      portfolio_url:        record.portfolio_url       || '',
      video_url:            record.video_url           || '',
      professional_summary: record.professional_summary || '',
      hourly_rate:          record.hourly_rate         || '',
      availability:         record.availability        || '',
      contract_type:        record.contract_type       || '',
      timezone:             record.timezone            || '',
      ideal_role:           record.ideal_role          || '',
      publish_profile:      record.publish_profile     === true,
      status:               record.status              || '',
      cronSchedule:         record.cronSchedule        || '',
      skill_javascript:     record.skill_javascript,
      skill_python:         record.skill_python,
      skill_react:          record.skill_react,
      skill_nodejs:         record.skill_nodejs,
      skill_typescript:     record.skill_typescript,
      skill_aws:            record.skill_aws,
      skill_docker:         record.skill_docker,
      skill_mongodb:        record.skill_mongodb,
      skill_postgresql:     record.skill_postgresql,
      skill_other_skills:   record.skill_other_skills  || '',
      // Task 2: expose plan for payment page state detection
      plan:                 record.plan                || null
    }
  }, 200, CORS);
}

export async function onRequestOptions({ request }) {
  const origin = request.headers.get('Origin') || '*';
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin':  origin,
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      'Access-Control-Max-Age':       '86400'
    }
  });
}

// ── Email ──────────────────────────────────────────────────────────────────────

async function sendConfirmationEmail(env, toEmail, toName, referenceNumber) {
  const subject = 'Your Virtual Launch Pro Reference Number & Next Steps';
  const body    = buildEmailBody(toName, referenceNumber);
  await sendEmail(env, toEmail, subject, body);
}

function buildEmailBody(name, referenceNumber) {
  return `Hi there,

Thank you for submitting your form and completing your payment. Your reference number is:

${referenceNumber}

Please keep this number handy — you'll need it to check your submission status anytime on Virtual Launch Pro.

Here's what you get as part of your membership:

  • Personalized Job Matches — Opportunities curated specifically for your skills.
  • Direct Introductions — We connect you directly with the opportunity posters.
  • Profile Amplification — Your profile gets more visibility to relevant opportunities.
  • Time-Saving Automation — Spend less time searching and more time applying.
  • Real-Time Notifications — Get instant updates on new matches and connections.

We also provide onboarding guidance to help you get started quickly and make the most of every opportunity.

Welcome aboard, and we look forward to helping you find your next freelance or contract opportunity faster and easier.

Regards,
Virtual Launch Pro Team`;
}

// ── R2 helpers ────────────────────────────────────────────────────────────────

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age':       '86400'
  };
}

function json(body, status, cors = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors }
  });
}

async function getRecord(env, key) {
  if (!env.ONBOARDING_R2) { console.warn('ONBOARDING_R2 binding missing'); return null; }
  const obj = await env.ONBOARDING_R2.get(key);
  if (!obj) return null;
  try { return await obj.json(); } catch { return null; }
}

async function putRecord(env, key, data) {
  if (!env.ONBOARDING_R2) { console.warn('ONBOARDING_R2 binding missing'); return; }
  await env.ONBOARDING_R2.put(key, JSON.stringify(data), {
    httpMetadata: { contentType: 'application/json' }
  });
}
