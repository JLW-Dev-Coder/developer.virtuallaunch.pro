// functions/forms/find-developers.js
// Pages Function — handles POST /forms/developer-match-intake
// Contract: contracts/find-developers.json
// Required bindings (Pages → Settings → Functions):
//   R2: ONBOARDING_R2 → onboarding-records bucket

import { sendTransactionalEmail } from '../_shared/email.js';

export async function onRequestPost({ request, env }) {
  const CORS = corsHeaders(request);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: 'validation_failed' }, 400, CORS);
  }

  // Validate required fields per contracts/find-developers.json payload.required
  const requiredFields = [
    'eventId', 'company', 'contactName', 'email',
    'projectType', 'budget', 'timeline', 'description',
    'skillsPreference', 'experienceLevel', 'selectedSkills'
  ];
  for (const field of requiredFields) {
    const val = payload[field];
    if (val === undefined || val === null || val === '') {
      return json({ ok: false, error: 'validation_failed' }, 400, CORS);
    }
  }

  // Validate enum fields
  const projectTypeEnum   = ['web-app', 'mobile-app', 'saas', 'api', 'other'];
  const budgetEnum        = ['under-10k', '10-50k', '50-100k', '100k+'];
  const timelineEnum      = ['1-month', '3-months', '6-months', 'flexible'];
  const skillsPrefEnum    = ['yes', 'no'];
  const expLevelEnum      = ['novice', 'intermediate', 'experienced'];

  if (!projectTypeEnum.includes(payload.projectType)) return json({ ok: false, error: 'validation_failed' }, 400, CORS);
  if (!budgetEnum.includes(payload.budget))           return json({ ok: false, error: 'validation_failed' }, 400, CORS);
  if (!timelineEnum.includes(payload.timeline))       return json({ ok: false, error: 'validation_failed' }, 400, CORS);
  if (!skillsPrefEnum.includes(payload.skillsPreference)) return json({ ok: false, error: 'validation_failed' }, 400, CORS);
  if (!expLevelEnum.includes(payload.experienceLevel))    return json({ ok: false, error: 'validation_failed' }, 400, CORS);
  if (!Array.isArray(payload.selectedSkills))             return json({ ok: false, error: 'validation_failed' }, 400, CORS);

  if (!env.ONBOARDING_R2) {
    return json({ ok: false, error: 'storage_unavailable' }, 500, CORS);
  }

  const { eventId } = payload;

  // Dedupe check — receipt key: receipts/form/{eventId}.json
  const receiptKey = `receipts/form/${eventId}.json`;
  const existingReceipt = await getRecord(env, receiptKey);
  if (existingReceipt) {
    return json({ ok: true, deduped: true, eventId }, 200, CORS);
  }

  const now = new Date().toISOString();

  // Build canonical record per effects.canonicalPatch
  const record = {
    eventId,
    recordId:        eventId,
    status:          'submitted',
    company:         payload.company,
    contactName:     payload.contactName,
    email:           payload.email,
    projectType:     payload.projectType,
    budget:          payload.budget,
    timeline:        payload.timeline,
    description:     payload.description,
    skillsPreference: payload.skillsPreference,
    experienceLevel: payload.experienceLevel,
    selectedSkills:  payload.selectedSkills,
    createdAt:       now,
    updatedAt:       now
  };

  // Write receipt first (effects.writeOrder: receiptAppend → canonicalUpsert)
  const receipt = { eventId, source: 'form', createdAt: now };
  await putRecord(env, receiptKey, receipt);

  // Write canonical record: developer-match-requests/{recordId}.json
  const canonicalKey = `developer-match-requests/${eventId}.json`;
  await putRecord(env, canonicalKey, record);

  // Send confirmation email — no dedicated find-developers template exists in emailTemplates.js
  // Skipping email: no template available for this flow
  // (No email on failure either — this is intentionally non-blocking)

  return json({ ok: true, eventId, status: 'submitted' }, 200, CORS);
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  if (!env.ONBOARDING_R2) return null;
  const obj = await env.ONBOARDING_R2.get(key);
  if (!obj) return null;
  try { return await obj.json(); } catch { return null; }
}

async function putRecord(env, key, data) {
  if (!env.ONBOARDING_R2) return;
  await env.ONBOARDING_R2.put(key, JSON.stringify(data), {
    httpMetadata: { contentType: 'application/json' }
  });
}
