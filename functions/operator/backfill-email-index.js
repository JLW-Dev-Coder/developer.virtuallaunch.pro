// functions/operator/backfill-email-index.js
// Pages Function — GET /operator/backfill-email-index
// Backfills onboarding-email-index/ entries for all existing onboarding records.
// Safe to call multiple times — fully idempotent.
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

  const auth = await verifyOperatorToken(request, env);
  if (!auth.valid) {
    return json({ ok: false, error: auth.error || 'unauthorized' }, 401, CORS);
  }

  if (!env.ONBOARDING_R2) {
    return json({ ok: false, error: 'r2_binding_missing' }, 500, CORS);
  }

  let total   = 0;
  let written = 0;
  let skipped = 0;
  let errors  = 0;

  // Paginate through all onboarding-records/
  let cursor    = undefined;
  let truncated = true;

  while (truncated) {
    const listOpts = { prefix: 'onboarding-records/', limit: 1000 };
    if (cursor) listOpts.cursor = cursor;

    const list = await env.ONBOARDING_R2.list(listOpts);
    truncated  = list.truncated;
    cursor     = list.truncated ? list.cursor : undefined;

    for (const obj of list.objects) {
      // Skip keys that are not top-level record files (e.g. sub-path objects)
      const key      = obj.key; // e.g. onboarding-records/VLP-abc123.json
      const basename = key.replace('onboarding-records/', '');
      if (!basename.endsWith('.json') || basename.includes('/')) continue;

      total++;

      try {
        const raw = await env.ONBOARDING_R2.get(key);
        if (!raw) { errors++; continue; }

        let record;
        try { record = await raw.json(); } catch { errors++; continue; }

        const email = record.email;
        if (!email || typeof email !== 'string') { errors++; continue; }

        const normalizedEmail = email.toLowerCase().trim();
        const indexKey        = `onboarding-email-index/${normalizedEmail}.json`;

        // eventId = record.eventId if present, otherwise derived from the R2 key suffix
        const eventId    = record.eventId || basename.replace('.json', '');
        const ref_number = record.ref_number || eventId;
        const createdAt  = record.createdAt || null;

        const existingObj = await env.ONBOARDING_R2.get(indexKey);

        if (!existingObj) {
          // Index entry missing — write it
          await env.ONBOARDING_R2.put(indexKey, JSON.stringify({ eventId, ref_number, createdAt }), {
            httpMetadata: { contentType: 'application/json' }
          });
          written++;
          continue;
        }

        // Index entry exists — check whether current record is newer
        let existing;
        try { existing = await existingObj.json(); } catch { existing = null; }

        const existingDate = existing?.createdAt ? new Date(existing.createdAt).getTime() : 0;
        const currentDate  = createdAt           ? new Date(createdAt).getTime()          : 0;

        if (currentDate > existingDate) {
          await env.ONBOARDING_R2.put(indexKey, JSON.stringify({ eventId, ref_number, createdAt }), {
            httpMetadata: { contentType: 'application/json' }
          });
          written++;
        } else {
          skipped++;
        }

      } catch (err) {
        console.error(`backfill-email-index error on key ${key}:`, err);
        errors++;
      }
    }
  }

  return json({ ok: true, total, written, skipped, errors }, 200, CORS);
}
