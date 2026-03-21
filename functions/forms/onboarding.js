// functions/forms/onboarding.js
// Pages Function — handles POST /forms/onboarding
// Required bindings (Pages → Settings → Functions):
//   R2:     ONBOARDING_R2  → onboarding-records bucket
//   Secret: GOOGLE_PRIVATE_KEY → your Google service account private key
//   Secret: GOOGLE_CLIENT_EMAIL → your Google service account email

const SERVICE_ACCOUNT_EMAIL  = 'virtual-launch-worker@virtual-launch-pro.iam.gserviceaccount.com'; // ← replace
const FROM_EMAIL             = 'noreply@virtuallaunch.pro';                       // ← replace
const FROM_NAME              = 'Virtual Launch Pro';

export async function onRequestPost({ request, env }) {
  const CORS = corsHeaders(request);

  try {
    const payload = await request.json();

    const requiredFields = ['confirmation', 'email', 'eventId', 'full_name'];
    for (const field of requiredFields) {
      if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
        return json({ ok: false, error: 'validation_failed' }, 400, CORS);
      }
    }

    if (payload.confirmation !== true) {
      return json({ ok: false, error: 'validation_failed' }, 400, CORS);
    }

    const recordKey = `onboarding-records/${payload.eventId}.json`;

    const existing = await getRecord(env, recordKey);
    if (existing) {
      return json(
        { deduped: true, eventId: payload.eventId, ok: true, status: 'already_submitted' },
        200, CORS
      );
    }

    const now = new Date().toISOString();
    await putRecord(env, recordKey, {
      ...payload,
      createdAt: now,
      status: 'submitted',
      updatedAt: now
    });

    // Send confirmation email (non-blocking — don't fail submission if email fails)
    try {
      await sendConfirmationEmail(env, payload.email, payload.full_name, payload.eventId);
    } catch (emailErr) {
      console.error('Email send failed (non-fatal):', emailErr);
    }

    return json({ eventId: payload.eventId, ok: true, status: 'submitted' }, 200, CORS);

  } catch (err) {
    console.error(err);
    return json({ ok: false, error: 'invalid_json' }, 400, CORS);
  }
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

// ── Email via Gmail API + Google service account ──────────────────────────────

async function sendConfirmationEmail(env, toEmail, toName, referenceNumber) {
  const privateKey   = env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
  const clientEmail  = env.GOOGLE_CLIENT_EMAIL || SERVICE_ACCOUNT_EMAIL;

  const accessToken = await getGoogleAccessToken(clientEmail, privateKey);

  const subject = 'Your Virtual Launch Pro Reference Number & Next Steps';
  const body    = buildEmailBody(toName, referenceNumber);

  const raw = buildRawEmail(FROM_EMAIL, FROM_NAME, toEmail, subject, body);

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail API error ${res.status}: ${err}`);
  }
}

function buildEmailBody(name, referenceNumber) {
  return `Hi there,

Thank you for submitting your form and completing your payment. Your reference number is:

${referenceNumber}

Please keep this number handy — you'll need it to check your submission status anytime on Virtual Launch Pro.

Here's what you get as part of your membership:

  • Personalized Job Matches — Opportunities curated specifically for your skills.
  • Direct Introductions — We connect you directly with the opportunity posters.
  • Profile Amplification — Your profile gets more visibility to relevant opportunities.
  • Time-Saving Automation — Spend less time searching and more time applying.
  • Real-Time Notifications — Get instant updates on new matches and connections.

We also provide onboarding guidance to help you get started quickly and make the most of every opportunity.

Welcome aboard, and we look forward to helping you find your next freelance or contract opportunity faster and easier.

Regards,
Virtual Launch Pro Team`;
}

function buildRawEmail(fromEmail, fromName, toEmail, subject, bodyText) {
  const message = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${toEmail}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    bodyText
  ].join('\r\n');

  // Base64url encode (Gmail API requires base64url, not standard base64)
  return btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ── Google OAuth2 JWT flow for service accounts ───────────────────────────────

async function getGoogleAccessToken(clientEmail, privateKeyPem) {
  const now  = Math.floor(Date.now() / 1000);
  const claim = {
    iss:   clientEmail,
    scope: 'https://www.googleapis.com/auth/gmail.send',
    aud:   'https://oauth2.googleapis.com/token',
    exp:   now + 3600,
    iat:   now
  };

  const jwt = await signJwt(claim, privateKeyPem);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth2:grant-type:jwt-bearer',
      assertion:  jwt
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function signJwt(payload, pemKey) {
  const header  = { alg: 'RS256', typ: 'JWT' };
  const encode  = obj => btoa(JSON.stringify(obj)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const signingInput = `${encode(header)}.${encode(payload)}`;

  const keyData   = pemToBinary(pemKey);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');

  return `${signingInput}.${sigB64}`;
}

function pemToBinary(pem) {
  const b64 = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

// ── R2 helpers ────────────────────────────────────────────────────────────────

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

async function putRecord(env, key, data) {
  if (!env.ONBOARDING_R2) { console.warn('ONBOARDING_R2 binding missing'); return; }
  await env.ONBOARDING_R2.put(key, JSON.stringify(data), {
    httpMetadata: { contentType: 'application/json' }
  });
}
