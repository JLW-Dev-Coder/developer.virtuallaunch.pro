// functions/operator/email.js
// POST /operator/email — send bulk email to filtered candidates (auth required)

import { sendEmail } from '../_shared/gmail.js';

function authCheck(request, env) {
  const key = request.headers.get('x-operator-key');
  return key && env.OPERATOR_KEY && key === env.OPERATOR_KEY;
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

// ── Template builders ──────────────────────────────────────────────────────────

function buildConsentPublish(name, ref) {
  return {
    subject: 'Your Developer Profile on Virtual Launch Pro',
    body: `Dear ${name},

To view your postings, go to the link below and enter your reference number ${ref}.

https://developers.virtuallaunch.pro/support.html

Thank you for trusting me with providing you with personalized vetted matches.

Don't forget to leave your review:
https://developers.virtuallaunch.pro/reviews.html

Your EA turned professional connector,
JLW
Virtual Launch Pro
developers.virtuallaunch.pro`
  };
}

function buildWelcomeAboard(name, ref) {
  return {
    subject: 'Welcome Aboard — You\'re Now Listed on Virtual Launch Pro',
    body: `Dear ${name},

Congratulations, you have joined a membership that gets you vetted people who want to work with your specific skills. Look out in your email in the next three days for your next lists of client matches. To view your matches, go to the link below and enter your reference number ${ref}.

https://developers.virtuallaunch.pro/support.html

Thank you for trusting me with providing you with personalized vetted matches.

Don't forget to leave your review:
https://developers.virtuallaunch.pro/reviews.html

Let's get you matched.

Your EA turned professional connector,
JLW
Virtual Launch Pro
developers.virtuallaunch.pro`
  };
}

function buildClientMatch(name, ref, job) {
  let body = `Dear ${name},

We found some client matches who are looking for the exact skills and expertise you offer. To view your matches, go to the link below and enter your reference number ${ref}.

https://developers.virtuallaunch.pro/support.html

Thank you for trusting me with personally vetted matches.

Don't forget to leave your review:
https://developers.virtuallaunch.pro/reviews.html

Let's get you matched.

Your EA turned professional connector,
JLW
Virtual Launch Pro
developers.virtuallaunch.pro`;

  if (job) {
    const skills = Array.isArray(job.required_skills) ? job.required_skills.join(', ') : (job.required_skills || '');
    body += `

---

Job Title: ${job.job_title || ''}
Description: ${job.job_description || ''}
Rate Range: ${job.hourly_rate_range || ''}
Skills Required: ${skills}
How to Apply: ${job.contact_method || ''}`;
  }

  return {
    subject: 'New Client Matches Found for You',
    body
  };
}

export async function onRequestPost({ request, env }) {
  const CORS = corsHeaders(request);
  if (!authCheck(request, env)) return json({ ok: false, error: 'unauthorized' }, 401, CORS);

  let body;
  try { body = await request.json(); } catch {
    return json({ ok: false, error: 'invalid_json' }, 400, CORS);
  }

  const { template, filters = {}, jobPostId } = body;

  if (!template || !['consentPublish', 'welcomeAboard', 'clientMatch'].includes(template)) {
    return json({ ok: false, error: 'invalid_template' }, 400, CORS);
  }

  // Load job post if provided
  let job = null;
  if (jobPostId) {
    job = await getRecord(env, `job-posts/${jobPostId}.json`);
  }

  // List all onboarding records
  if (!env.ONBOARDING_R2) return json({ ok: false, error: 'storage_unavailable' }, 500, CORS);

  const objects = [];
  let list = await env.ONBOARDING_R2.list({ prefix: 'onboarding-records/' });
  objects.push(...list.objects);
  while (list.truncated) {
    list = await env.ONBOARDING_R2.list({ prefix: 'onboarding-records/', cursor: list.cursor });
    objects.push(...list.objects);
  }

  const results = { sent: 0, skipped: 0, errors: [] };

  for (const obj of objects) {
    const record = await getRecord(env, obj.key);
    if (!record) continue;

    // Only send to candidates where publish_profile is true
    if (record.publish_profile !== true) { results.skipped++; continue; }
    // Only send to candidates who have opted in (have an email)
    if (!record.email) { results.skipped++; continue; }

    // Apply optional filters
    let include = true;
    for (const [field, value] of Object.entries(filters)) {
      if (value !== '' && value !== null && value !== undefined) {
        if (record[field] !== value) { include = false; break; }
      }
    }
    if (!include) { results.skipped++; continue; }

    const name = record.full_name || 'Developer';
    const ref  = record.eventId  || '';

    let emailContent;
    if (template === 'consentPublish')  emailContent = buildConsentPublish(name, ref);
    else if (template === 'welcomeAboard') emailContent = buildWelcomeAboard(name, ref);
    else emailContent = buildClientMatch(name, ref, job);

    try {
      await sendEmail(env, record.email, emailContent.subject, emailContent.body);
      results.sent++;
    } catch (err) {
      results.errors.push({ email: record.email, error: String(err) });
    }
  }

  return json({ ok: true, ...results }, 200, CORS);
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}
