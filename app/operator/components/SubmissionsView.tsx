'use client';

import { useEffect, useState } from 'react';
import { getSubmissions, type OnboardingRecord } from '@/lib/api';
import styles from '../operator.module.css';

const STATUS_OPTS = ['', 'pending', 'active', 'denied', 'archived'];

export default function SubmissionsView({ onSelectDev }: { onSelectDev: (ref: string) => void }) {
  const [rows, setRows] = useState<OnboardingRecord[] | null>(null);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState(false);

  function load(s = status, p = page) {
    setRows(null); setError(false);
    const params: Record<string, string> = { limit: '25', page: String(p) };
    if (s) params.status = s;
    getSubmissions(params)
      .then(d => { setRows(d.results ?? []); setTotal(d.total ?? 0); })
      .catch(() => setError(true));
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.875rem', borderRadius: '0.5rem', background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.2)', fontSize: '0.75rem', color: '#6ee7b7' }}>
        Only paid (Intro Track) developers receive curated job matches.
      </div>
      <div className={styles.viewHead}>
        <h2 className={styles.viewTitle}>Submissions <span style={{ color: '#475569', fontSize: '0.75rem' }}>({total})</span></h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="vlp-input" style={{ width: 140, fontSize: '0.78rem', padding: '6px 10px' }}
            value={status} onChange={e => { setStatus(e.target.value); setPage(1); load(e.target.value, 1); }}>
            {STATUS_OPTS.map(s => <option key={s} value={s}>{s || 'All statuses'}</option>)}
          </select>
          <button className="btn-secondary btn-sm" onClick={() => load()}>Refresh</button>
        </div>
      </div>

      {error && <div className={styles.errorBox}>Could not load submissions.</div>}

      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Ref</th><th>Name</th><th>Email</th><th>Status</th><th>Created</th>
            </tr>
          </thead>
          <tbody>
            {!rows && !error && [1,2,3,4,5].map(i => (
              <tr key={i}><td colSpan={5}><div className="skeleton" style={{ height: 14 }} /></td></tr>
            ))}
            {rows && rows.length === 0 && (
              <tr><td colSpan={5}><div className={styles.empty}><p>No submissions found.</p></div></td></tr>
            )}
            {rows && rows.map(r => (
              <tr key={r.eventId} onClick={() => onSelectDev(String(r.eventId))}>
                <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#6ee7b7' }}>{String(r.ref_number ?? r.eventId)}</td>
                <td>{String(r.full_name ?? '—')}</td>
                <td style={{ color: '#64748b' }}>{String(r.email ?? '—')}</td>
                <td><span className={`badge badge-${r.status}`}>{String(r.status ?? '—')}</span></td>
                <td style={{ color: '#64748b', fontSize: '0.72rem' }}>{r.createdAt ? new Date(String(r.createdAt)).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows && total > 25 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
          <button className="btn-secondary btn-sm" disabled={page === 1} onClick={() => { const p = page - 1; setPage(p); load(status, p); }}>← Prev</button>
          <span style={{ fontSize: '0.78rem', color: '#64748b', alignSelf: 'center' }}>Page {page}</span>
          <button className="btn-secondary btn-sm" disabled={rows.length < 25} onClick={() => { const p = page + 1; setPage(p); load(status, p); }}>Next →</button>
        </div>
      )}
    </div>
  );
}
