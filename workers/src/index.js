// workers/src/index.js
// Cloudflare Worker for onboarding + support status lookup with R2 storage

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',          // tighten to your domain in production
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept'
};

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (url.pathname === '/forms/onboarding' && request.method === 'POST') {
      return handleOnboarding(request, env);
    }

    if (url.pathname === '/forms/support/status' && request.method === 'GET') {
      return handleSupportStatus(request, env);
    }

    return json({ ok: false, error: 'not_found' }, 404);
  }
};

/**
 * =========================
 * Onboarding Handler
 * =========================
 */
async function handleOnboarding(request, env) {
  try {
    const payload = await request.json();

    const requiredFields = ['confirmation', 'email', 'eventId', 'full_name'];

    for (const field of requiredFields) {
      if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
        return json({ ok: false, error: 'validation_failed' }, 400);
      }
    }

    // confirmation must be boolean true
    if (payload.confirmation !== true) {
      return json({ ok: false, error: 'validation_failed' }, 400);
    }

    const recordId  = payload.eventId;
    const recordKey = buildRecordKey(recordId);

    // Dedup check
    const existing = await getRecord(env, recordKey);

    if (existing) {
      return json({
        deduped: true,
        eventId: recordId,
        ok: true,
        status: 'already_submitted'
      });
    }

    const now = new Date().toISOString();

    const record = {
      ...payload,
      createdAt: now,
      status:    'submitted',
      updatedAt: now
    };

    await putRecord(env, recordKey, record);

    return json({
      eventId: recordId,
      ok:      true,
      status:  'submitted'
    });

  } catch (err) {
    console.error(err);
    return json({ ok: false, error: 'invalid_json' }, 400);
  }
}

/**
 * =========================
 * Support Status Handler
 * =========================
 */
async function handleSupportStatus(request, env) {
  const url       = new URL(request.url);
  const clientRef = url.searchParams.get('clientRef');

  if (!clientRef || !isValidClientRef(clientRef)) {
    return json({ ok: false, error: 'invalid_reference' }, 400);
  }

  const recordKey = buildRecordKey(clientRef);
  const record    = await getRecord(env, recordKey);

  if (!record) {
    return json({ ok: false, error: 'not_found' }, 404);
  }

  return json({
    eventId:   clientRef,
    ok:        true,
    status:    record.status    || 'submitted',
    updatedAt: record.updatedAt || record.createdAt
  });
}

/**
 * =========================
 * Helpers
 * =========================
 */

function buildRecordKey(eventId) {
  return `onboarding-records/${eventId}.json`;
}

async function getRecord(env, key) {
  if (!env.ONBOARDING_R2) {
    console.warn('ONBOARDING_R2 binding missing');
    return null;
  }

  const obj = await env.ONBOARDING_R2.get(key);
  if (!obj) return null;

  try {
    return await obj.json();
  } catch {
    return null;
  }
}

async function putRecord(env, key, data) {
  if (!env.ONBOARDING_R2) {
    console.warn('ONBOARDING_R2 binding missing');
    return;
  }

  await env.ONBOARDING_R2.put(
    key,
    JSON.stringify(data),
    { httpMetadata: { contentType: 'application/json' } }
  );
}

// Matches VLP- followed by one or more alphanumeric chars (no interior hyphens).
// The onboarding page now generates IDs in this format: VLP-<base36ts><base36rnd>
function isValidClientRef(ref) {
  return /^VLP-[a-zA-Z0-9]+$/.test(ref);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS
    }
  });
}