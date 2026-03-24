// functions/operator/jobs.js
// POST /operator/jobs — create a new job post (auth required)
// GET  /operator/jobs — return all job posts sorted newest first (auth required)

function authCheck(request, env) {
  const key = request.headers.get('x-operator-key');
  return key && env.OPERATOR_KEY && key === env.OPERATOR_KEY;
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

function generatePostId() {
  const ts  = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `JP-${ts}${rnd}`;
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

export async function onRequestPost({ request, env }) {
  const CORS = corsHeaders(request);
  if (!authCheck(request, env)) return json({ ok: false, error: 'unauthorized' }, 401, CORS);

  try {
    const body = await request.json();
    const { job_title, job_description, hourly_rate_range, required_skills, contact_method } = body;

    if (!job_title || !job_description || !hourly_rate_range || !contact_method) {
      return json({ ok: false, error: 'missing_required_fields' }, 400, CORS);
    }
    if (!Array.isArray(required_skills) || required_skills.length === 0) {
      return json({ ok: false, error: 'required_skills_must_be_array' }, 400, CORS);
    }

    const postId = generatePostId();
    const now = new Date().toISOString();
    const record = {
      postId,
      job_title,
      job_description,
      hourly_rate_range,
      required_skills,
      contact_method,
      posted_date: now,
      status: body.status || 'active'
    };

    await putRecord(env, `job-posts/${postId}.json`, record);
    return json({ ok: true, postId }, 200, CORS);

  } catch (err) {
    console.error(err);
    return json({ ok: false, error: 'invalid_json' }, 400, CORS);
  }
}

export async function onRequestGet({ request, env }) {
  const CORS = corsHeaders(request);
  if (!authCheck(request, env)) return json({ ok: false, error: 'unauthorized' }, 401, CORS);
  if (!env.ONBOARDING_R2) return json({ ok: true, jobs: [] }, 200, CORS);

  const objects = [];
  let list = await env.ONBOARDING_R2.list({ prefix: 'job-posts/' });
  objects.push(...list.objects);
  while (list.truncated) {
    list = await env.ONBOARDING_R2.list({ prefix: 'job-posts/', cursor: list.cursor });
    objects.push(...list.objects);
  }

  const jobs = [];
  for (const obj of objects) {
    const record = await getRecord(env, obj.key);
    if (record) jobs.push(record);
  }

  // Sort newest first
  jobs.sort((a, b) => new Date(b.posted_date) - new Date(a.posted_date));

  return json({ ok: true, jobs }, 200, CORS);
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}
