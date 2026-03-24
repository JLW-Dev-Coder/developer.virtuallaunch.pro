// public/js/developers.js
// Fetches published developer profiles and builds filter UI from contract schema

(async function () {
  const SCHEMA_URL     = '/contracts/onboarding-schema.json';
  const DEVELOPERS_URL = '/forms/developers';

  let allDevelopers = [];
  let filterableFields = [];
  let debounceTimer = null;

  // ── Bootstrap ─────────────────────────────────────────────────────────────────
  async function init() {
    try {
      const [schemaRes, devsRes] = await Promise.all([
        fetch(SCHEMA_URL),
        fetch(DEVELOPERS_URL)
      ]);
      const schemaData = await schemaRes.json();
      const devsData   = await devsRes.json();

      filterableFields = (schemaData.filterable_fields || []).filter(f =>
        f.name !== 'publish_profile' // already filtered server-side, skip from UI
      );

      allDevelopers = (devsData.developers || []).filter(d => d.publish_profile === true);

      buildFilterUI();
      renderCards(allDevelopers);
    } catch (err) {
      console.error('Failed to load developers:', err);
      document.getElementById('dev-grid').innerHTML =
        '<p class="col-span-full text-slate-400 text-center py-8">Failed to load developer profiles. Please try again later.</p>';
    }
  }

  // Task 2: URL and skill filter constants
  const URL_FILTER_FIELDS = [
    { name: 'linkedin_url',  label: 'LinkedIn' },
    { name: 'portfolio_url', label: 'Portfolio' },
    { name: 'video_url',     label: 'Video' }
  ];
  const SKILL_FIELDS = [
    'javascript','python','react','nodejs','typescript',
    'aws','docker','mongodb','postgresql'
  ];

  // ── Filter UI ─────────────────────────────────────────────────────────────────
  function buildFilterUI() {
    const sidebar = document.getElementById('filter-sidebar');
    if (!sidebar) return;

    let html = '';

    // Keyword search for professional_summary
    html += `
      <div class="mb-6">
        <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Keyword Search</label>
        <input type="text" id="filter-keyword" placeholder="Search by summary…"
          class="w-full border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 bg-slate-900 transition placeholder-slate-600
                 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30">
      </div>`;

    // Hourly rate range
    html += `
      <div class="mb-6">
        <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Hourly Rate (USD)</label>
        <div class="flex gap-2 items-center">
          <input type="number" id="filter-rate-min" placeholder="Min" min="0"
            class="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 bg-slate-900 transition
                   focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30">
          <span class="text-slate-500 text-sm">–</span>
          <input type="number" id="filter-rate-max" placeholder="Max" min="0"
            class="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 bg-slate-900 transition
                   focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30">
        </div>
      </div>`;

    // Filterable fields from contract (skip booleans and fields without clear enum or values)
    for (const field of filterableFields) {
      if (field.type === 'boolean') continue;

      // Collect unique values from loaded data for multi-select
      const values = field.enum
        ? field.enum
        : [...new Set(allDevelopers.map(d => d[field.name]).filter(Boolean))].sort();

      if (values.length === 0) {
        console.warn(`[developers.js] Filter field "${field.name}" has no values in listing data — skipping.`);
        continue;
      }

      const label = field.description || field.name.replace(/_/g, ' ');
      html += `
        <div class="mb-6">
          <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">${esc(label)}</label>
          <select multiple id="filter-${field.name}"
            class="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 bg-slate-900 transition min-h-[80px]
                   focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30">
            ${values.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('')}
          </select>
          <p class="text-xs text-slate-500 mt-1">Hold Ctrl/⌘ to select multiple</p>
        </div>`;
    }

    // Task 2: URL availability filters (linkedin_url, portfolio_url, video_url)
    html += `<div class="border-t border-slate-700/40 pt-5 mb-1"><p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Profile Links</p></div>`;
    for (const f of URL_FILTER_FIELDS) {
      html += `
        <div class="mb-5">
          <label class="block text-xs font-semibold text-slate-300 mb-2">${esc(f.label)}</label>
          <div class="flex flex-wrap gap-3">
            ${[['any','Any'],['has','Available'],['none','Not provided']].map(([v, lbl], i) => `
              <label class="flex items-center gap-1.5 cursor-pointer text-xs text-slate-300 hover:text-slate-100">
                <input type="radio" name="filter-url-${f.name}" value="${v}" ${i === 0 ? 'checked' : ''}
                  class="accent-emerald-500"> ${esc(lbl)}
              </label>`).join('')}
          </div>
        </div>`;
    }

    // Task 2: Skill threshold filters
    html += `<div class="border-t border-slate-700/40 pt-5 mb-1"><p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Skills (min. rating)</p></div>`;
    for (const s of SKILL_FIELDS) {
      const label = s === 'nodejs' ? 'Node.js'
                  : s === 'aws'    ? 'AWS'
                  : s.charAt(0).toUpperCase() + s.slice(1);
      html += `
        <div class="mb-4">
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">${esc(label)}</label>
          <div class="flex flex-wrap gap-2">
            ${[['any','Any'],['3','3+'],['5','5+'],['7','7+'],['9','9+']].map(([v, lbl], i) => `
              <label class="flex items-center gap-1 cursor-pointer text-xs text-slate-400 hover:text-slate-200">
                <input type="radio" name="filter-skill-${s}" value="${v}" ${i === 0 ? 'checked' : ''}
                  class="accent-emerald-500"> ${esc(lbl)}
              </label>`).join('')}
          </div>
        </div>`;
    }

    // Clear filters button
    html += `<div class="border-t border-slate-700/40 pt-4 mt-2"><button id="clear-filters" class="w-full px-4 py-2.5 border border-slate-700 hover:border-emerald-500/50 text-slate-300 hover:text-slate-100 text-sm font-medium rounded-lg transition-all duration-200">Clear All Filters</button></div>`;

    sidebar.innerHTML = html;

    // Bind events
    const debouncedFilter = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(applyFilters, 200);
    };

    document.getElementById('filter-keyword').addEventListener('input', debouncedFilter);
    document.getElementById('filter-rate-min').addEventListener('input', debouncedFilter);
    document.getElementById('filter-rate-max').addEventListener('input', debouncedFilter);

    for (const field of filterableFields) {
      if (field.type === 'boolean') continue;
      const el = document.getElementById(`filter-${field.name}`);
      if (el) el.addEventListener('change', debouncedFilter);
    }

    // Task 2: bind URL and skill radio groups
    for (const f of URL_FILTER_FIELDS) {
      sidebar.querySelectorAll(`input[name="filter-url-${f.name}"]`).forEach(r =>
        r.addEventListener('change', debouncedFilter));
    }
    for (const s of SKILL_FIELDS) {
      sidebar.querySelectorAll(`input[name="filter-skill-${s}"]`).forEach(r =>
        r.addEventListener('change', debouncedFilter));
    }

    document.getElementById('clear-filters').addEventListener('click', () => {
      document.getElementById('filter-keyword').value = '';
      document.getElementById('filter-rate-min').value = '';
      document.getElementById('filter-rate-max').value = '';
      for (const field of filterableFields) {
        const el = document.getElementById(`filter-${field.name}`);
        if (el) Array.from(el.options).forEach(o => (o.selected = false));
      }
      // Task 2: reset URL and skill radios to "any"
      for (const f of URL_FILTER_FIELDS) {
        const el = sidebar.querySelector(`input[name="filter-url-${f.name}"][value="any"]`);
        if (el) el.checked = true;
      }
      for (const s of SKILL_FIELDS) {
        const el = sidebar.querySelector(`input[name="filter-skill-${s}"][value="any"]`);
        if (el) el.checked = true;
      }
      renderCards(allDevelopers);
    });
  }

  // ── Apply Filters ──────────────────────────────────────────────────────────────
  function applyFilters() {
    let results = allDevelopers.filter(d => d.publish_profile === true);

    // Keyword search on professional_summary
    const keyword = (document.getElementById('filter-keyword')?.value || '').trim().toLowerCase();
    if (keyword) {
      results = results.filter(d => (d.professional_summary || '').toLowerCase().includes(keyword));
    }

    // Hourly rate range
    const rateMin = parseFloat(document.getElementById('filter-rate-min')?.value);
    const rateMax = parseFloat(document.getElementById('filter-rate-max')?.value);
    if (!isNaN(rateMin)) {
      results = results.filter(d => {
        const rate = parseFloat(d.hourly_rate);
        return !isNaN(rate) && rate >= rateMin;
      });
    }
    if (!isNaN(rateMax)) {
      results = results.filter(d => {
        const rate = parseFloat(d.hourly_rate);
        return !isNaN(rate) && rate <= rateMax;
      });
    }

    // Multi-select filterable fields
    for (const field of filterableFields) {
      if (field.type === 'boolean') continue;
      const el = document.getElementById(`filter-${field.name}`);
      if (!el) continue;
      const selected = Array.from(el.options).filter(o => o.selected).map(o => o.value);
      if (selected.length > 0) {
        results = results.filter(d => selected.includes(String(d[field.name] || '')));
      }
    }

    // Task 2: URL availability filters
    for (const f of URL_FILTER_FIELDS) {
      const checked = document.querySelector(`input[name="filter-url-${f.name}"]:checked`);
      const val = checked ? checked.value : 'any';
      if (val === 'has') {
        results = results.filter(d => d[f.name] && String(d[f.name]).trim());
      } else if (val === 'none') {
        results = results.filter(d => !d[f.name] || !String(d[f.name]).trim());
      }
    }

    // Task 2: skill minimum threshold filters
    for (const s of SKILL_FIELDS) {
      const checked = document.querySelector(`input[name="filter-skill-${s}"]:checked`);
      const val = checked ? checked.value : 'any';
      if (val !== 'any') {
        const min = parseInt(val, 10);
        results = results.filter(d => typeof d[`skill_${s}`] === 'number' && d[`skill_${s}`] >= min);
      }
    }

    renderCards(results);
  }

  // ── Render Cards ──────────────────────────────────────────────────────────────
  function renderCards(developers) {
    const grid = document.getElementById('dev-grid');
    const count = document.getElementById('dev-count');
    if (!grid) return;

    // Task 2: show "Showing X of Y developers" count
    if (count) {
      const total = allDevelopers.length;
      const shown = developers.length;
      count.textContent = `Showing ${shown} of ${total} developer${total !== 1 ? 's' : ''}`;
    }

    if (developers.length === 0) {
      grid.innerHTML = '<p class="col-span-full text-slate-400 text-center py-12">No developer profiles match the current filters.</p>';
      return;
    }

    grid.innerHTML = developers.map(d => {
      const linkedinLink = d.linkedin_url
        ? `<a href="${esc(d.linkedin_url)}" target="_blank" rel="noopener noreferrer" title="LinkedIn"
             class="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition mt-1">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
             LinkedIn</a>`
        : '';

      const portfolioLink = d.portfolio_url
        ? `<a href="${esc(d.portfolio_url)}" target="_blank" rel="noopener noreferrer" title="Portfolio"
             class="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition mt-1">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
             Portfolio</a>`
        : '';

      const videoThumb = d.video_url
        ? `<a href="${esc(d.video_url)}" target="_blank" rel="noopener noreferrer"
             class="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition mt-1">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
             Video</a>`
        : '';

      const rate = d.hourly_rate ? `$${esc(d.hourly_rate)}/hr` : '';
      const summary = (d.professional_summary || '').slice(0, 180) + ((d.professional_summary || '').length > 180 ? '…' : '');

      return `
        <div class="flex flex-col rounded-2xl border border-slate-700/50 bg-slate-800/30 p-6 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300">
          <div class="flex items-start justify-between gap-3 mb-3">
            <div class="min-w-0">
              <h3 class="font-semibold text-slate-100 text-base truncate">${esc(d.full_name)}</h3>
              ${d.country ? `<p class="text-xs text-slate-400 mt-0.5">${esc(d.country)}</p>` : ''}
            </div>
            ${rate ? `<span class="text-sm font-semibold text-emerald-400 whitespace-nowrap">${rate}</span>` : ''}
          </div>

          ${d.availability ? `<p class="text-xs text-slate-500 mb-3"><span class="text-slate-400">Availability:</span> ${esc(d.availability)}</p>` : ''}

          ${summary ? `<p class="text-sm text-slate-300 leading-relaxed flex-1 mb-4">${esc(summary)}</p>` : '<p class="flex-1"></p>'}

          <div class="flex flex-wrap gap-3 mt-auto pt-3 border-t border-slate-700/30">
            ${linkedinLink}
            ${portfolioLink}
            ${videoThumb}
          </div>
        </div>`;
    }).join('');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function esc(t) {
    const d = document.createElement('div');
    d.textContent = String(t || '');
    return d.innerHTML;
  }

  // ── Run ───────────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
