import Stripe from 'stripe';

export async function onRequestPost({ request, env }) {
  // Validate required env vars
  if (!env.STRIPE_SECRET_KEY)  return jsonError(500, 'STRIPE_SECRET_KEY is not configured');
  if (!env.STRIPE_PRICE_FREE)  return jsonError(500, 'STRIPE_PRICE_FREE is not configured');
  if (!env.STRIPE_PRICE_PAID)  return jsonError(500, 'STRIPE_PRICE_PAID is not configured');
  if (!env.ONBOARDING_R2)      return jsonError(500, 'ONBOARDING_R2 is not configured');

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'Invalid JSON body');
  }

  const { vlp_ref, plan, email, full_name, internal = false } = body;

  // Validate required fields
  if (!vlp_ref || !plan || !email || !full_name) {
    return jsonError(400, 'Missing required fields: vlp_ref, plan, email, full_name');
  }
  if (plan !== 'free' && plan !== 'paid') {
    return jsonError(400, 'plan must be "free" or "paid"');
  }

  // Verify record exists in R2
  const recordKey = `onboarding-records/${vlp_ref}.json`;
  const existing = await env.ONBOARDING_R2.get(recordKey);
  if (!existing) {
    return Response.json({ ok: false, error: 'record_not_found' }, { status: 400 });
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });

  const sessionParams = {
    customer_email: email,
    client_reference_id: vlp_ref,
    metadata: { vlp_ref, plan, full_name },
    success_url: `https://developers.virtuallaunch.pro/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `https://developers.virtuallaunch.pro/onboarding.html`,
  };

  if (plan === 'free') {
    sessionParams.mode = 'payment';
    sessionParams.line_items = [{ price: env.STRIPE_PRICE_FREE, quantity: 1 }];
  } else {
    sessionParams.mode = 'subscription';
    sessionParams.line_items = [{ price: env.STRIPE_PRICE_PAID, quantity: 1 }];
    sessionParams.payment_method_collection = 'always';
    sessionParams.subscription_data = { metadata: { vlp_ref, plan } };
    if (internal && env.STRIPE_INTERNAL_COUPON_ID) {
      sessionParams.discounts = [{ coupon: env.STRIPE_INTERNAL_COUPON_ID }];
    }
  }

  let session;
  try {
    session = await stripe.checkout.sessions.create(sessionParams);
  } catch (err) {
    console.error('Stripe session creation failed:', {
      type: err.type,
      message: err.message,
      code: err.code,
    });
    return Response.json(
      { ok: false, error: 'stripe_error', message: err.message },
      { status: 500 }
    );
  }

  return Response.json({ ok: true, url: session.url });
}

function jsonError(status, message) {
  return Response.json({ ok: false, error: message }, { status });
}
