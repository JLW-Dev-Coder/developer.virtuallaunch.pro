// functions/operator/profiles.js
// GET  /operator/profiles          — list all onboarding records (auth required)
// PATCH /operator/profiles/:id/publish — toggle publish_profile (auth required)

function authCheck(request, env) {
  const key = request.headers.get('x-operator-key');
  return key && env.OPERATOR_KEY && key === env.OPERATOR_KEY;
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, x-operator-key',
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

export async function onRequestGet({ request, env }) {
  const CORS = corsHeaders(request);
  if (!authCheck(request, env)) return json({ ok: false, error: 'unauthorized' }, 401, CORS);
  if (!env.ONBOARDING_R2) return json({ ok: true, profiles: [] }, 200, CORS);

  const objects = [];
  let list = await env.ONBOARDING_R2.list({ prefix: 'onboarding-records/' });
  objects.push(...list.objects);
  while (list.truncated) {
    list = await env.ONBOARDING_R2.list({ prefix: 'onboarding-records/', cursor: list.cursor });
    objects.push(...list.objects);
  }

  const profiles = [];
  for (const obj of objects) {
    const record = await getRecord(env, obj.key);
    if (!record) continue;
    profiles.push(record);
  }

  return json({ ok: true, profiles }, 200, CORS);
}

// PATCH /operator/profiles — toggle publish_profile for a given record id
// Expects body: { id, publish_profile }
export async function onRequestPatch({ request, env }) {
  const CORS = corsHeaders(request);
  if (!authCheck(request, env)) return json({ ok: false, error: 'unauthorized' }, 401, CORS);

  try {
    const body = await request.json();
    const { id, publish_profile } = body;
    if (!id) return json({ ok: false, error: 'id_required' }, 400, CORS);

    const recordKey = `onboarding-records/${id}.json`;
    const record = await getRecord(env, recordKey);
    if (!record) return json({ ok: false, error: 'not_found' }, 404, CORS);

    record.publish_profile = publish_profile === true;
    record.updatedAt = new Date().toISOString();
    await putRecord(env, recordKey, record);

    return json({ ok: true, id, publish_profile: record.publish_profile }, 200, CORS);
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: 'invalid_json' }, 400, CORS);
  }
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}
