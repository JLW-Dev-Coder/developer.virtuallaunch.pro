#!/usr/bin/env node
// scripts/dedupe-onboarding-records.js
// Cleans up duplicate onboarding records in R2, keeping the newest per email address.
//
// Usage:
//   CLOUDFLARE_ACCOUNT_ID=<id> CLOUDFLARE_API_TOKEN=<token> node scripts/dedupe-onboarding-records.js
//
// Dry run runs first and prints what would be deleted.
// You must confirm before any deletions are made.
//
// Env vars required:
//   CLOUDFLARE_ACCOUNT_ID  — your Cloudflare account ID
//   CLOUDFLARE_API_TOKEN   — token with R2:Edit permission
//   R2_BUCKET_NAME         — defaults to "onboarding-records"

import { createInterface } from 'readline';

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

    if (!data.success) {
      throw new Error(`R2 LIST error: ${JSON.stringify(data.errors)}`);
    }

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

  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function deleteR2Object(key) {
  const res = await fetch(`${BASE_URL}/objects/${encodeURIComponent(key)}`, {
    method:  'DELETE',
    headers: { 'Authorization': `Bearer ${API_TOKEN}` }
  });

  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`R2 DELETE failed for ${key}: ${res.status} ${text}`);
  }
}

// ── Prompt helper ─────────────────────────────────────────────────────────────

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nScanning R2 bucket "${BUCKET_NAME}" for duplicate onboarding records...\n`);

  // 1. List all onboarding record keys
  const keys = await listR2Objects('onboarding-records/');
  console.log(`Found ${keys.length} object(s) under onboarding-records/\n`);

  if (keys.length === 0) {
    console.log('No records found. Nothing to do.');
    return;
  }

  // 2. Fetch each record and extract email + metadata
  console.log('Fetching records to check for duplicate emails...');
  const records = [];
  let fetchErrors = 0;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    process.stdout.write(`  [${i + 1}/${keys.length}] ${key} ... `);

    const record = await getR2Object(key);
    if (!record) {
      console.log('(skipped — null or unreadable)');
      fetchErrors++;
      continue;
    }

    const email = typeof record.email === 'string' ? record.email.toLowerCase().trim() : null;
    if (!email) {
      console.log('(skipped — no email field)');
      fetchErrors++;
      continue;
    }

    records.push({
      key,
      email,
      eventId:   record.eventId   || null,
      createdAt: record.createdAt || null,
      full_name: record.full_name || '(unknown)'
    });

    console.log(`ok`);
  }

  console.log(`\nFetched ${records.length} readable record(s). ${fetchErrors} skipped.\n`);

  // 3. Group by normalized email
  const byEmail = {};
  for (const r of records) {
    if (!byEmail[r.email]) byEmail[r.email] = [];
    byEmail[r.email].push(r);
  }

  // 4. Identify duplicates — for each email, keep newest by createdAt
  const toDelete = [];

  for (const [email, group] of Object.entries(byEmail)) {
    if (group.length <= 1) continue;

    // Sort descending by createdAt; records without createdAt go to the end
    group.sort((a, b) => {
      if (!a.createdAt && !b.createdAt) return 0;
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return b.createdAt.localeCompare(a.createdAt);
    });

    const keeper = group[0];
    const dupes  = group.slice(1);

    console.log(`  EMAIL: ${email}  (${group.length} records)`);
    console.log(`    KEEP:   ${keeper.key}  (createdAt: ${keeper.createdAt || 'unknown'})`);
    for (const d of dupes) {
      console.log(`    DELETE: ${d.key}  (createdAt: ${d.createdAt || 'unknown'}, eventId: ${d.eventId || 'unknown'})`);
      toDelete.push(d);
    }
    console.log('');
  }

  if (toDelete.length === 0) {
    console.log('No duplicates found. Nothing to delete.');
    return;
  }

  // 5. Dry run summary
  console.log('─'.repeat(60));
  console.log(`DRY RUN SUMMARY`);
  console.log('─'.repeat(60));
  console.log(`Records to delete:         ${toDelete.length}`);
  console.log(`Receipts to delete:        ${toDelete.filter(d => d.eventId).length}  (receipts/form/{eventId}.json)`);
  console.log('─'.repeat(60));
  console.log('\nRecords that would be deleted:');
  for (const d of toDelete) {
    console.log(`  • ${d.key}`);
    if (d.eventId) {
      console.log(`    receipt: receipts/form/${d.eventId}.json`);
    }
  }
  console.log('');

  const answer = await prompt('Proceed with deletion? [yes/no]: ');

  if (answer !== 'yes') {
    console.log('\nAborted. No records were deleted.');
    return;
  }

  // 6. Delete confirmed
  console.log('\nDeleting...\n');
  let deleted   = 0;
  let receipts  = 0;
  let errors    = 0;

  for (const d of toDelete) {
    // Delete main record
    try {
      await deleteR2Object(d.key);
      console.log(`  ✓  deleted ${d.key}`);
      deleted++;
    } catch (err) {
      console.error(`  ✗  failed to delete ${d.key}: ${err.message}`);
      errors++;
    }

    // Delete corresponding receipt
    if (d.eventId) {
      const receiptKey = `receipts/form/${d.eventId}.json`;
      try {
        await deleteR2Object(receiptKey);
        console.log(`  ✓  deleted ${receiptKey}`);
        receipts++;
      } catch (err) {
        console.error(`  ✗  failed to delete ${receiptKey}: ${err.message}`);
        errors++;
      }
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`Done.`);
  console.log(`  Records deleted:  ${deleted}`);
  console.log(`  Receipts deleted: ${receipts}`);
  console.log(`  Errors:           ${errors}`);
  console.log('─'.repeat(60));

  if (errors > 0) process.exit(1);
}

main().catch(err => {
  console.error('Script error:', err.message);
  process.exit(1);
});
