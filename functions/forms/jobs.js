// functions/forms/jobs.js
// GET /forms/jobs — public endpoint returning all active job posts newest first

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

export async function onRequestGet({ request, env }) {
  const CORS = corsHeaders(request);
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
    const r = await env.ONBOARDING_R2.get(obj.key);
    if (!r) continue;
    let record;
    try { record = await r.json(); } catch { continue; }
    if (record.status === 'closed') continue; // skip closed jobs
    jobs.push(record);
  }

  // Sort newest first
  jobs.sort((a, b) => new Date(b.posted_date) - new Date(a.posted_date));

  return json({ ok: true, jobs }, 200, CORS);
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}
