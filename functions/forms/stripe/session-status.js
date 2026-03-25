import Stripe from 'stripe';

export async function onRequestGet({ request, env }) {
  // Validate required env vars
  if (!env.STRIPE_SECRET_KEY) return jsonError(500, 'STRIPE_SECRET_KEY is not configured');
  if (!env.ONBOARDING_R2)     return jsonError(500, 'ONBOARDING_R2 is not configured');

  const url = new URL(request.url);
  const session_id = url.searchParams.get('session_id');
  if (!session_id) {
    return jsonError(400, 'Missing required query param: session_id');
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(session_id);
  } catch (err) {
    console.error('Failed to retrieve Stripe session:', err.message);
    return jsonError(500, 'Failed to retrieve checkout session');
  }

  const vlp_ref = session.client_reference_id;

  // Look up R2 record
  let record = null;
  if (vlp_ref) {
    const obj = await env.ONBOARDING_R2.get(`onboarding-records/${vlp_ref}.json`);
    if (obj) {
      try { record = await obj.json(); } catch { record = null; }
    }
  }

  // Derive status from record
  let status;
  let plan = null;
  let webhookConfirmed = false;
  let webhookEvent = null;

  if (!record) {
    // Webhook may not have arrived yet
    status = 'processing';
  } else {
    const ps = record.paymentStatus;
    const wca = record.webhookConfirmedAt;

    if (ps === 'completed' && wca) {
      status = 'completed';
      webhookConfirmed = true;
    } else if (ps === 'failed' || ps === 'cancelled') {
      status = 'error';
    } else {
      status = 'processing';
    }

    plan = record.planConfirmed || record.plan || null;
    webhookEvent = record.webhookEvent || null;
    webhookConfirmed = !!(record.webhookConfirmedAt);
  }

  return Response.json({
    ok: true,
    status,
    plan,
    webhookConfirmed,
    webhookEvent,
    vlp_ref: vlp_ref || null,
  });
}

function jsonError(status, message) {
  return Response.json({ ok: false, error: message }, { status });
}
