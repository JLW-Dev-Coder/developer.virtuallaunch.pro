// functions/forms/developers.js
// GET /forms/developers — public endpoint returning only publish_profile=true records

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
  if (!env.ONBOARDING_R2) return json({ ok: true, developers: [] }, 200, CORS);

  const objects = [];
  let list = await env.ONBOARDING_R2.list({ prefix: 'onboarding-records/' });
  objects.push(...list.objects);
  while (list.truncated) {
    list = await env.ONBOARDING_R2.list({ prefix: 'onboarding-records/', cursor: list.cursor });
    objects.push(...list.objects);
  }

  const developers = [];
  for (const obj of objects) {
    const r = await env.ONBOARDING_R2.get(obj.key);
    if (!r) continue;
    let record;
    try { record = await r.json(); } catch { continue; }

    // Only expose records where publish_profile is explicitly true
    if (record.publish_profile !== true) continue;

    developers.push({
      eventId:              record.eventId,
      full_name:            record.full_name            || '',
      availability:         record.availability         || '',
      country:              record.country              || '',
      hourly_rate:          record.hourly_rate          || '',
      professional_summary: record.professional_summary || '',
      linkedin_url:         record.linkedin_url         || '',
      portfolio_url:        record.portfolio_url        || '',
      video_url:            record.video_url            || '',
      contract_type:        record.contract_type        || '',
      timezone:             record.timezone             || '',
      status:               record.status               || '',
      cronSchedule:         record.cronSchedule         || '',
      publish_profile:      true
    });
  }

  return json({ ok: true, developers }, 200, CORS);
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}
