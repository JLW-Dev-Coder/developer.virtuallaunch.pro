// functions/forms/onboarding/status.js
// GET /forms/onboarding/status
// Public endpoint — no auth required.
// Returns status and lastUpdated only for the given VLP- reference ID.

export async function onRequestGet(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  const referenceId = url.searchParams.get('referenceId');

  if (!referenceId) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_referenceId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Scan onboarding-records/ for a record matching ref_number
  let cursor;
  do {
    const listOpts = { prefix: 'onboarding-records/' };
    if (cursor) listOpts.cursor = cursor;

    const list = await env.ONBOARDING_R2.list(listOpts);

    for (const obj of list.objects) {
      try {
        const res = await env.ONBOARDING_R2.get(obj.key);
        if (!res) continue;
        const record = JSON.parse(await res.text());
        if (record.ref_number === referenceId) {
          return new Response(JSON.stringify({
            ok: true,
            referenceId,
            status: record.status,
            lastUpdated: record.updatedAt
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } catch {
        // Skip unreadable records
      }
    }

    cursor = list.truncated ? list.cursor : null;
  } while (cursor);

  return new Response(JSON.stringify({ ok: false, error: 'not_found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequest(context) {
  if (context.request.method !== 'GET') {
    return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return onRequestGet(context);
}
