#!/usr/bin/env node
// scripts/backfill-email-index.js
// Writes the email index (onboarding-email-index/{email}.json) for all existing
// onboarding records that are not yet indexed.
//
// For emails with multiple records: writes the index entry for the newest record
// (by createdAt). Skips any email that already has an index entry.
//
// Usage:
//   CLOUDFLARE_ACCOUNT_ID=<id> CLOUDFLARE_API_TOKEN=<token> node scripts/backfill-email-index.js
//
// Env vars required:
//   CLOUDFLARE_ACCOUNT_ID  — your Cloudflare account ID
//   CLOUDFLARE_API_TOKEN   — token with R2:Edit permission
//   R2_BUCKET_NAME         — defaults to "onboarding-records"

const ACCOUNT_ID  = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN   = process.env.CLOUDFLARE_API_TOKEN;
const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'onboarding-records';
const BASE_URL    = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET_NAME}`;

if (!ACCOUNT_ID || !API_TOKEN) {
  console.error('Missing required env vars: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN');
  process.exit(1);
}

// ── R2 REST helpers ───────────────────────────────────────────────────────────

async function listR2Objects(prefix) {
  const objects = [];
  let cursor    = null;
  let truncated = true;

  while (truncated) {
    const params = new URLSearchParams({ prefix, per_page: '1000' });
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(`${BASE_URL}/objects?${params}`, {
      headers: { 'Authorization': `Bearer ${API_TOKEN}` }
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`R2 LIST failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    if (!data.success) throw new Error(`R2 LIST error: ${JSON.stringify(data.errors)}`);

    for (const obj of (data.result?.objects || [])) {
      objects.push(obj.key);
    }

    truncated = data.result?.truncated || false;
    cursor    = data.result?.cursor    || null;
  }

  return objects;
}

async function getR2Object(key) {
  const res = await fetch(`${BASE_URL}/objects/${encodeURIComponent(key)}`, {
    headers: { 'Authorization': `Bearer ${API_TOKEN}` }
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`R2 GET failed for ${key}: ${res.status} ${text}`);
  }

  try { return await res.json(); } catch { return null; }
}

async function putR2Object(key, value) {
  const res = await fetch(`${BASE_URL}/objects/${encodeURIComponent(key)}`, {
    method:  'PUT',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type':  'application/json'
    },
    body: JSON.stringify(value)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`R2 PUT failed for ${key}: ${res.status} ${text}`);
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nBackfilling email index in R2 bucket "${BUCKET_NAME}"...\n`);

  // 1. List all onboarding records
  const keys = await listR2Objects('onboarding-records/');
  console.log(`Found ${keys.length} record(s) under onboarding-records/\n`);

  if (keys.length === 0) {
    console.log('No records to backfill.');
    return;
  }

  // 2. Fetch all records
  console.log('Fetching records...');
  const records = [];

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    process.stdout.write(`  [${i + 1}/${keys.length}] ${key} ... `);

    const record = await getR2Object(key);
    if (!record) {
      console.log('(skipped — null or unreadable)');
      continue;
    }

    const email = typeof record.email === 'string' ? record.email.toLowerCase().trim() : null;
    if (!email) {
      console.log('(skipped — no email field)');
      continue;
    }

    records.push({
      key,
      email,
      eventId:   record.eventId   || null,
      createdAt: record.createdAt || null
    });

    console.log('ok');
  }

  console.log(`\nLoaded ${records.length} readable record(s).\n`);

  // 3. Group by email, keep newest per email
  const byEmail = {};
  for (const r of records) {
    if (!byEmail[r.email]) byEmail[r.email] = [];
    byEmail[r.email].push(r);
  }

  const candidates = [];
  for (const [email, group] of Object.entries(byEmail)) {
    group.sort((a, b) => {
      if (!a.createdAt && !b.createdAt) return 0;
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return b.createdAt.localeCompare(a.createdAt);
    });
    candidates.push({ email, record: group[0] });
  }

  console.log(`Unique emails: ${candidates.length}\n`);

  // 4. For each email, check if index exists; write if absent
  let written  = 0;
  let skipped  = 0;
  let errors   = 0;

  for (const { email, record } of candidates) {
    const indexKey     = `onboarding-email-index/${email}.json`;
    const existingIdx  = await getR2Object(indexKey);

    if (existingIdx) {
      console.log(`  skip  ${indexKey}  (already exists)`);
      skipped++;
      continue;
    }

    if (!record.eventId) {
      console.log(`  skip  ${email}  (record has no eventId — cannot write index)`);
      skipped++;
      continue;
    }

    const entry = {
      eventId:   record.eventId,
      ref_number: record.eventId,
      createdAt: record.createdAt || new Date().toISOString()
    };

    try {
      await putR2Object(indexKey, entry);
      console.log(`  ✓  wrote ${indexKey}  (eventId: ${record.eventId})`);
      written++;
    } catch (err) {
      console.error(`  ✗  failed ${indexKey}: ${err.message}`);
      errors++;
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`Done.`);
  console.log(`  Index entries written: ${written}`);
  console.log(`  Skipped (existing):    ${skipped}`);
  console.log(`  Errors:                ${errors}`);
  console.log('─'.repeat(60));

  if (errors > 0) process.exit(1);
}

main().catch(err => {
  console.error('Script error:', err.message);
  process.exit(1);
});
