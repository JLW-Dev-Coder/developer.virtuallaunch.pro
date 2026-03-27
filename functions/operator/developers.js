// functions/operator/developers.js
// Pages Function — GET /operator/developers
// Lightweight list for operator dropdowns and filters.
// Returns ref_number, full_name, status, publish_profile only — never full records.
// Required bindings:
//   KV: OPERATOR_SESSIONS — for verifyOperatorToken
//   R2: ONBOARDING_R2 — onboarding records bucket

import { verifyOperatorToken } from './_verifyToken.js';

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
    'Access-Control-Max-Age':       '86400'
  };
}

function json(body, status, cors = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors }
  });
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function onRequestGet({ request, env }) {
  const CORS = corsHeaders(request);

  // verifyOperatorToken first — before anything else
  const auth = await verifyOperatorToken(request, env);
  if (!auth.valid) {
    return json({ ok: false, error: auth.error || 'unauthorized' }, 401, CORS);
  }

  const url          = new URL(request.url);
  const statusFilter = url.searchParams.get('status')  || null;
  const publishRaw   = url.searchParams.get('publish') || null;

  // List all R2 records — handle R2 pagination (>1000 objects)
  const allRecords = [];
  let cursor;
  do {
    const listOpts = { prefix: 'onboarding-records/' };
    if (cursor) listOpts.cursor = cursor;
    const listed = await env.ONBOARDING_R2.list(listOpts);
    const batch  = await Promise.all(
      listed.objects.map(async (obj) => {
        const res = await env.ONBOARDING_R2.get(obj.key);
        if (!res) return null;
        try { return JSON.parse(await res.text()); } catch { return null; }
      })
    );
    allRecords.push(...batch.filter(Boolean));
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  // Apply optional filters
  let filtered = allRecords;

  if (statusFilter) {
    filtered = filtered.filter(r => r.status === statusFilter);
  }
  if (publishRaw !== null) {
    const publishBool = publishRaw === 'true';
    filtered = filtered.filter(r => r.publish_profile === publishBool);
  }

  // Return shape with fields needed by the operator Developers table
  return json({
    ok:      true,
    results: filtered.map(r => {
      // Reshape flat skill_* fields into a nested skills object
      const skills = {};
      for (const [k, v] of Object.entries(r)) {
        if (k.startsWith('skill_')) skills[k] = v;
      }
      return {
        ref_number:      r.eventId         || r.ref_number  || null,
        full_name:       r.full_name       || null,
        email:           r.email           || null,
        skills:          Object.keys(skills).length ? skills : null,
        hourly_rate:     r.hourly_rate     || null,
        country:         r.country         || null,
        cronSchedule:    r.cronSchedule    || null,
        status:          r.status          || null,
        publish_profile: r.publish_profile === true
      };
    })
  }, 200, CORS);
}
