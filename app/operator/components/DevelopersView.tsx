'use client';

import { useEffect, useState } from 'react';
import { getOperatorDevelopers, updateDeveloper, type Developer } from '@/lib/api';
import styles from '../operator.module.css';

type Row = Pick<Developer, 'ref_number' | 'full_name' | 'status' | 'publish_profile' | 'plan'>;

export default function DevelopersView({ onSelectDev }: { onSelectDev: (ref: string) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  function load() {
    setRows(null); setError(false);
    getOperatorDevelopers().then(d => setRows(d.results ?? [])).catch(() => setError(true));
  }

  useEffect(() => { load(); }, []);

  async function togglePublish(ref: string, current: boolean) {
    setToggling(ref);
    try {
      await updateDeveloper({ ref_number: ref, publish_profile: !current });
      setRows(prev => prev?.map(r => r.ref_number === ref ? { ...r, publish_profile: !current } : r) ?? null);
    } catch { /* ignore */ }
    setToggling(null);
  }

  return (
    <div>
      <div className={styles.viewHead}>
        <h2 className={styles.viewTitle}>Developers</h2>
        <button className="btn-secondary btn-sm" onClick={load}>Refresh</button>
      </div>
      {error && <div className={styles.errorBox}>Could not load developers.</div>}
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr><th>Ref</th><th>Name</th><th>Plan</th><th>Status</th><th>Published</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {!rows && !error && [1,2,3].map(i => (
              <tr key={i}><td colSpan={6}><div className="skeleton" style={{ height: 14 }} /></td></tr>
            ))}
            {rows && rows.length === 0 && (
              <tr><td colSpan={6}><div className={styles.empty}><p>No developers found.</p></div></td></tr>
            )}
            {rows && rows.map(r => (
              <tr key={r.ref_number}>
                <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#6ee7b7' }}>{r.ref_number}</td>
                <td>{String(r.full_name ?? '—')}</td>
                <td>
                  {r.plan === 'paid'
                    ? <span className="badge" style={{ background: 'rgba(16,185,129,.15)', color: '#34d399', border: '1px solid rgba(16,185,129,.3)', fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 9999 }}>Featured</span>
                    : <span style={{ color: '#475569', fontSize: '0.72rem' }}>Free</span>}
                </td>
                <td><span className={`badge badge-${r.status}`}>{String(r.status)}</span></td>
                <td>
                  <div
                    className={`toggle-track ${r.publish_profile ? 'on' : ''} ${toggling === r.ref_number ? '' : ''}`}
                    onClick={() => togglePublish(r.ref_number, r.publish_profile)}
                    style={{ cursor: toggling === r.ref_number ? 'wait' : 'pointer' }}
                  >
                    <div className="toggle-knob" />
                  </div>
                </td>
                <td>
                  <button className="btn-secondary btn-sm" onClick={() => onSelectDev(r.ref_number)}>View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
