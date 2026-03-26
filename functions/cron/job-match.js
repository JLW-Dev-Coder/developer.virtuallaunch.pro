// functions/cron/job-match.js
// POST /cron/job-match
// Internal cron trigger — matches active published developers to a job post,
// queues bulk email notifications, updates nextNotificationDue per cronSchedule.
// Auth: x-cron-secret header (CRON_SECRET env var) — NOT operator Bearer token.

import { sendBulkEmail } from '../_shared/email.js';
import { cronMatchNotification } from '../_shared/emailTemplates.js';

const DEDUPE_TTL = 86400; // 24 hours

function calcNextNotificationDue(cronSchedule) {
  const now = Date.now();
  if (cronSchedule === '3 days')  return new Date(now + 3  * 24 * 60 * 60 * 1000).toISOString();
  if (cronSchedule === '7 days')  return new Date(now + 7  * 24 * 60 * 60 * 1000).toISOString();
  if (cronSchedule === '14 days') return new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString();
  return null;
}

export async function onRequest(context) {
  const { request, env } = context;

  // Auth — x-cron-secret only
  const cronSecret = request.headers.get('x-cron-secret');
  if (!cronSecret || cronSecret !== env.CRON_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { eventId, jobId, required_skills = [], notifyAll = false } = payload;

  if (!eventId || !jobId) {
    return new Response(JSON.stringify({ ok: false, error: 'validation_failed', missing: ['eventId', 'jobId'].filter(f => !payload[f]) }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Dedupe check
  const dedupeKey = `cron-dedupe:${eventId}`;
  const existing = await env.OPERATOR_SESSIONS.get(dedupeKey);
  if (existing) {
    return new Response(JSON.stringify({ ok: true, deduped: true, eventId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Fetch job record
  const jobObj = await env.ONBOARDING_R2.get(`job-posts/${jobId}.json`);
  if (!jobObj) {
    return new Response(JSON.stringify({ ok: false, error: 'job_not_found', jobId }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const jobRecord = JSON.parse(await jobObj.text());
  const jobRequiredSkills = required_skills.length > 0
    ? required_skills
    : (jobRecord.required_skills || []);

  // Load all developer records with R2 pagination
  const allRecords = [];
  let cursor;
  do {
    const listOpts = { prefix: 'onboarding-records/' };
    if (cursor) listOpts.cursor = cursor;

    const list = await env.ONBOARDING_R2.list(listOpts);

    const batch = await Promise.all(
      list.objects.map(async obj => {
        try {
          const res = await env.ONBOARDING_R2.get(obj.key);
          return res ? JSON.parse(await res.text()) : null;
        } catch {
          return null;
        }
      })
    );

    allRecords.push(...batch.filter(Boolean));
    cursor = list.truncated ? list.cursor : null;
  } while (cursor);

  // Filter: active + published
  const eligible = allRecords.filter(r =>
    r.status === 'active' && r.publish_profile === true
  );

  // Match by skills or notifyAll
  const matched = notifyAll
    ? eligible
    : eligible.filter(dev =>
        jobRequiredSkills.length === 0 ||
        jobRequiredSkills.some(skill => dev[skill] != null && parseInt(dev[skill]) >= 1)
      );

  const ranAt = new Date().toISOString();

  // Update nextNotificationDue per developer — non-fatal per record
  await Promise.all(matched.map(async dev => {
    try {
      const nextDue = calcNextNotificationDue(dev.cronSchedule);
      if (!nextDue) return;

      const recordKey = `onboarding-records/${dev.eventId || dev.ref_number}.json`;
      const updated = { ...dev, nextNotificationDue: nextDue, updatedAt: ranAt };
      await env.ONBOARDING_R2.put(recordKey, JSON.stringify(updated));
    } catch (err) {
      console.error(`Failed to update nextNotificationDue for ${dev.ref_number}:`, err.message);
    }
  }));

  // Send bulk notification email — non-fatal
  try {
    if (matched.length > 0) {
      const recipients = [...new Set(matched.map(d => d.email).filter(Boolean))];
      const { subject, html, text } = cronMatchNotification({
        jobTitle: jobRecord.jobTitle || jobRecord.title || '',
        jobDescription: jobRecord.jobDescription || jobRecord.description || '',
        jobId
      });
      await sendBulkEmail(env, { recipients, subject, html, text });
    }
  } catch (err) {
    console.error('sendBulkEmail failed in cron job-match:', err.message);
  }

  // Write run record
  const runRecord = {
    eventId,
    jobId,
    matchedCount: matched.length,
    queuedCount: matched.length,
    ranAt,
    status: 'complete'
  };

  const runRecordStr = JSON.stringify(runRecord);

  await Promise.all([
    env.ONBOARDING_R2.put(`cron-job-match-runs/${eventId}.json`, runRecordStr),
    env.ONBOARDING_R2.put(`receipts/cron/job-match/${eventId}.json`, runRecordStr)
  ]);

  // Write KV dedupe key
  await env.OPERATOR_SESSIONS.put(dedupeKey, '1', { expirationTtl: DEDUPE_TTL });

  return new Response(JSON.stringify({
    ok: true,
    eventId,
    jobId,
    matchedCount: matched.length,
    queuedCount: matched.length,
    ranAt
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
