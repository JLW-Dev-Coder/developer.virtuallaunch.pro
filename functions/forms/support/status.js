// functions/forms/support/status.js
// Pages Function — handles GET /forms/support/status?clientRef=VLP-xxxxx

export async function onRequestGet({ request, env }) {
  const CORS = corsHeaders(request);
  const url = new URL(request.url);
  const clientRef = url.searchParams.get('clientRef');

  if (!clientRef || !/^VLP-[a-zA-Z0-9]+$/.test(clientRef)) {
    return json({ ok: false, error: 'invalid_reference' }, 400, CORS);
  }

  const recordKey = `onboarding-records/${clientRef}.json`;
  const record    = await getRecord(env, recordKey);

  if (!record) {
    return json({ ok: false, error: 'not_found' }, 404, CORS);
  }

  return json({
    eventId:   clientRef,
    ok:        true,
    status:    record.status    || 'submitted',
    updatedAt: record.updatedAt || record.createdAt
  }, 200, CORS);
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
