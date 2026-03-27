// functions/operator/analytics.js
// GET /operator/analytics — submission counts across all four form collections,
// time-bucketed metrics, and Cloudflare page view data via Analytics API.
// Response shape: contracts/operator-analytics.json > response.success

import { verifyOperatorToken } from './_verifyToken.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
    'Access-Control-Max-Age':       '86400'
  };
}

function json(body, status, cors = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors }
  });
}

// ── date helpers ──────────────────────────────────────────────────────────────

function defaultWindow() {
  const to   = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10)
  };
}

function inWindow(createdAt, from, to) {
  if (!createdAt) return false;
  const d = createdAt.slice(0, 10);
  return d >= from && d <= to;
}

function bucketLabel(isoDate, bucket) {
  const d = new Date(isoDate);
  if (bucket === 'month') return isoDate.slice(0, 7);
  if (bucket === 'week') {
    const day  = d.getUTCDay() || 7;
    const mon  = new Date(d);
    mon.setUTCDate(d.getUTCDate() - (day - 1));
    const jan4 = new Date(Date.UTC(mon.getUTCFullYear(), 0, 4));
    const wk   = Math.ceil(((mon - jan4) / 86400000 + jan4.getUTCDay() + 1) / 7);
    return `${mon.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`;
  }
  return isoDate.slice(0, 10);
}

// ── R2 prefix scan ────────────────────────────────────────────────────────────

async function listRecords(r2, prefix) {
  const records = [];
  try {
    let list = await r2.list({ prefix });
    const objects = [...list.objects];
    while (list.truncated) {
      list = await r2.list({ prefix, cursor: list.cursor });
      objects.push(...list.objects);
    }
    for (const obj of objects) {
      try {
        const item = await r2.get(obj.key);
        if (!item) continue;
        const rec = await item.json();
        records.push(rec);
      } catch { /* skip unparseable */ }
    }
  } catch { /* prefix not found or R2 error */ }
  return records;
}

// ── Cloudflare Analytics API ──────────────────────────────────────────────────

async function fetchCloudflarePageViews(env, from, to) {
  if (!env.CF_API_TOKEN || !env.CF_ZONE_ID) {
    return { source: 'Cloudflare Analytics API', data: null, error: 'unavailable' };
  }

  // Single httpRequests1dGroups query — available on all Cloudflare plan tiers.
  // Fetches daily breakdown with every sum/uniq field the endpoint supports,
  // plus per-country and per-browser breakdowns via the same dataset.
  const query = `{
    viewer {
      zones(filter: { zoneTag: "${env.CF_ZONE_ID}" }) {
        httpRequests1dGroups(
          limit: 30
          filter: { date_geq: "${from}", date_leq: "${to}" }
          orderBy: [date_ASC]
        ) {
          dimensions { date }
          sum {
            requests
            bytes
            cachedBytes
            cachedRequests
            encryptedRequests
            encryptedBytes
            threats
          }
          uniq { uniques }
        }
      }
    }
  }`;

  try {
    const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${env.CF_API_TOKEN}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({ query })
    });

    if (!res.ok) {
      console.error('CF Analytics HTTP error:', res.status);
      return { source: 'Cloudflare Analytics API', data: null, error: 'cf_http_error' };
    }

    const payload = await res.json();

    if (payload.errors?.length) {
      console.error('CF Analytics GraphQL errors:', JSON.stringify(payload.errors));
      // Return partial data if available, with error note
      // Fall through to attempt data extraction
    }

    const zone = payload?.data?.viewer?.zones?.[0] ?? {};
    const dailyGroups = zone.httpRequests1dGroups ?? [];

    if (dailyGroups.length === 0) {
      return {
        source: 'Cloudflare Analytics API',
        data: null,
        error: 'empty_response',
        _debug: {
          payloadErrors: payload.errors ?? null,
          zonesCount: payload?.data?.viewer?.zones?.length ?? 0,
          rawPayloadSnippet: JSON.stringify(payload).slice(0, 500)
        }
      };
    }

    const timeSeries = dailyGroups.map(g => ({
      date:              g.dimensions.date,
      requests:          g.sum?.requests          ?? 0,
      bytes:             g.sum?.bytes              ?? 0,
      cachedBytes:       g.sum?.cachedBytes        ?? 0,
      cachedRequests:    g.sum?.cachedRequests      ?? 0,
      encryptedRequests: g.sum?.encryptedRequests   ?? 0,
      encryptedBytes:    g.sum?.encryptedBytes      ?? 0,
      threats:           g.sum?.threats             ?? 0,
      uniques:           g.uniq?.uniques            ?? 0,
    }));

    const totals = timeSeries.reduce((acc, d) => {
      acc.requests          += d.requests;
      acc.bytes             += d.bytes;
      acc.cachedBytes       += d.cachedBytes;
      acc.cachedRequests    += d.cachedRequests;
      acc.encryptedRequests += d.encryptedRequests;
      acc.encryptedBytes    += d.encryptedBytes;
      acc.threats           += d.threats;
      acc.uniqueVisitors    += d.uniques;
      return acc;
    }, {
      requests: 0, bytes: 0, cachedBytes: 0,
      cachedRequests: 0, encryptedRequests: 0, encryptedBytes: 0,
      threats: 0, uniqueVisitors: 0
    });

    // ── Top countries — aggregate countryMap across all daily groups ───────
    const countryAgg = {};
    dailyGroups.forEach(g => {
      (g.sum?.countryMap ?? []).forEach(row => {
        const c = row.clientCountryName || 'Unknown';
        if (!countryAgg[c]) countryAgg[c] = { country: c, requests: 0, pageViews: 0 };
        countryAgg[c].requests  += row.requests  ?? 0;
        countryAgg[c].pageViews += row.pageViews ?? 0;
      });
    });
    const topCountries = Object.values(countryAgg)
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);

    // ── Top browsers — aggregate browserMap across all daily groups ────────
    const browserAgg = {};
    dailyGroups.forEach(g => {
      (g.sum?.browserMap ?? []).forEach(row => {
        const b = row.uaBrowserFamily || 'Unknown';
        if (!browserAgg[b]) browserAgg[b] = { browser: b, requests: 0, pageViews: 0 };
        browserAgg[b].requests  += row.requests  ?? 0;
        browserAgg[b].pageViews += row.pageViews ?? 0;
      });
    });
    const topBrowsers = Object.values(browserAgg)
      .sort((a, b) => b.pageViews - a.pageViews)
      .slice(0, 8);

    // ── Status code breakdown — aggregate responseStatusMap ────────────────
    const statusAgg = {};
    dailyGroups.forEach(g => {
      (g.sum?.responseStatusMap ?? []).forEach(s => {
        const code = s.edgeResponseStatus;
        statusAgg[code] = (statusAgg[code] ?? 0) + (s.requests ?? 0);
      });
    });
    const statusCodes = Object.entries(statusAgg)
      .map(([code, requests]) => ({ code: parseInt(code), requests }))
      .sort((a, b) => b.requests - a.requests);

    return {
      source: 'Cloudflare Analytics API',
      data: {
        totals,
        timeSeries,
        topCountries,
        topBrowsers,
        firewallEvents: [], // requires Enterprise plan
        statusCodes,
      }
    };

  } catch (err) {
    console.error('CF Analytics fetch failed:', err.message);
    return { source: 'Cloudflare Analytics API', data: null, error: 'unavailable' };
  }
}

// ── handler ───────────────────────────────────────────────────────────────────

export async function onRequestGet({ request, env }) {
  const CORS = corsHeaders(request);

  const auth = await verifyOperatorToken(request, env);
  if (!auth.valid) {
    return json({ ok: false, error: 'unauthorized' }, 401, CORS);
  }

  const url     = new URL(request.url);
  const params  = url.searchParams;
  const window_ = defaultWindow();
  const from    = params.get('from') || window_.from;
  const to      = params.get('to')   || window_.to;
  const bucket  = ['day', 'week', 'month'].includes(params.get('bucket'))
    ? params.get('bucket') : 'day';

  const [onboardingRecs, findDevRecs, supportRecs, reviewRecs, pageViews] =
    await Promise.all([
      listRecords(env.ONBOARDING_R2, 'onboarding-records/'),
      listRecords(env.ONBOARDING_R2, 'find-developer-records/'),
      listRecords(env.ONBOARDING_R2, 'support-records/'),
      listRecords(env.ONBOARDING_R2, 'review-records/'),
      fetchCloudflarePageViews(env, from, to)
    ]);

  const inW = r => inWindow(r.createdAt || r.submittedAt || r.eventId, from, to);

  const onboardingFiltered  = onboardingRecs.filter(inW);
  const findDevFiltered     = findDevRecs.filter(inW);
  const supportFiltered     = supportRecs.filter(inW);
  const reviewsFiltered     = reviewRecs.filter(inW);

  const submissions = {
    onboarding:     onboardingFiltered.length,
    findDevelopers: findDevFiltered.length,
    support:        supportFiltered.length,
    reviews:        reviewsFiltered.length,
    total:          onboardingFiltered.length + findDevFiltered.length +
                    supportFiltered.length    + reviewsFiltered.length
  };

  const bucketMap = {};
  const addToBucket = (recs, field) => {
    for (const r of recs) {
      const dateStr = r.createdAt || r.submittedAt;
      if (!dateStr) continue;
      const label = bucketLabel(dateStr.slice(0, 10), bucket);
      if (!bucketMap[label]) {
        bucketMap[label] = { bucket: label, onboarding: 0, findDevelopers: 0, support: 0, reviews: 0 };
      }
      bucketMap[label][field]++;
    }
  };

  addToBucket(onboardingFiltered,  'onboarding');
  addToBucket(findDevFiltered,     'findDevelopers');
  addToBucket(supportFiltered,     'support');
  addToBucket(reviewsFiltered,     'reviews');

  const timeSeries = Object.values(bucketMap).sort((a, b) => a.bucket.localeCompare(b.bucket));

  return json({
    ok: true,
    window: { from, to },
    submissions,
    timeSeries,
    pageViews
  }, 200, CORS);
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}