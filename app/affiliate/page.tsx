'use client';

import { useEffect, useState, useCallback } from 'react';
import Header from '@/components/Header';
import BackgroundEffects from '@/components/BackgroundEffects';
import AuthGuard from '@/components/AuthGuard';
import type { Session } from '@/lib/api';
import {
  getAffiliate,
  getAffiliateEvents,
  startAffiliateOnboarding,
  requestPayout,
  type AffiliateData,
  type AffiliateEvent,
} from '@/lib/api';
import styles from './page.module.css';

function fmt(cents: number) {
  return '$' + (cents / 100).toFixed(2);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function AffiliateDashboard({ session }: { session: Session }) {
  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null);
  const [events, setEvents] = useState<AffiliateEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutResult, setPayoutResult] = useState<{ payout_id: string; amount: number } | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [aff, evts] = await Promise.all([
        getAffiliate(session.id),
        getAffiliateEvents(session.id).finally(() => setEventsLoading(false)),
      ]);
      setAffiliate(aff);
      setEvents(Array.isArray(evts) ? evts : []);
    } catch {
      setError('Failed to load affiliate data.');
    } finally {
      setLoading(false);
      setEventsLoading(false);
    }
  }, [session.id]);

  useEffect(() => { load(); }, [load]);

  async function handleCopy() {
    if (!affiliate?.referral_url) return;
    try {
      await navigator.clipboard.writeText(affiliate.referral_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard access denied — silently ignore */
    }
  }

  async function handleConnect() {
    setConnectLoading(true);
    try {
      const { onboard_url } = await startAffiliateOnboarding();
      window.location.href = onboard_url;
    } catch {
      setError('Could not start onboarding. Please try again.');
      setConnectLoading(false);
    }
  }

  async function handlePayout() {
    if (!affiliate) return;
    setPayoutLoading(true);
    setError('');
    try {
      const result = await requestPayout(affiliate.balance_pending);
      setPayoutResult({ payout_id: result.payout_id, amount: result.amount });
      setAffiliate(prev => prev ? { ...prev, balance_pending: 0 } : prev);
    } catch {
      setError('Payout request failed. Please try again.');
    } finally {
      setPayoutLoading(false);
    }
  }

  const payoutDisabled =
    !affiliate ||
    affiliate.balance_pending < 1000 ||
    affiliate.connect_status !== 'active' ||
    payoutLoading;

  const payoutTooltip = !affiliate
    ? ''
    : affiliate.connect_status !== 'active'
    ? 'Connect your bank account to withdraw'
    : affiliate.balance_pending < 1000
    ? 'Minimum payout is $10'
    : '';

  return (
    <div className={styles.app}>
      <BackgroundEffects />
      <Header />
      <main className={styles.main}>
        <div className={styles.inner}>
          <div className={styles.pageHead}>
            <p className={styles.eyebrow}>Affiliate Program</p>
            <h1 className={styles.pageTitle}>Your Affiliate Dashboard</h1>
            <p className={styles.pageSub}>
              Earn 20% commission on every purchase your referrals make, for life — across all platforms.
            </p>
          </div>

          {error && (
            <div style={{ marginBottom: '1.5rem', padding: '10px 16px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.18)', borderRadius: 8, color: '#fca5a5', fontSize: '0.8125rem' }}>
              {error}
            </div>
          )}

          {/* ── Section 1: Referral Link ─────────────────────────────────── */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>Referral Link</p>
            <div className={styles.card}>
              <h2 className={styles.referralHeading}>Your Referral Link</h2>
              <p className={styles.referralSub}>
                Share this link. Earn 20% commission on every purchase your referrals make, for life.
              </p>
              {loading ? (
                <div className={styles.copyRow}>
                  <div className={styles.referralInput} style={{ height: 40, background: 'rgba(30,41,59,0.6)', borderColor: 'rgba(51,65,85,0.3)' }} />
                </div>
              ) : (
                <div className={styles.copyRow}>
                  <input
                    className={styles.referralInput}
                    readOnly
                    value={affiliate?.referral_url ?? ''}
                    onFocus={e => e.target.select()}
                  />
                  <button
                    className={`${styles.copyBtn} ${copied ? styles.copyBtnCopied : ''}`}
                    onClick={handleCopy}
                    disabled={!affiliate?.referral_url}
                  >
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Section 2: Earnings Summary ──────────────────────────────── */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>Earnings</p>
            <div className={styles.statsRow}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Pending</div>
                {loading ? (
                  <>
                    <div className={styles.skeletonValue} />
                    <div className={styles.skeletonText} />
                  </>
                ) : (
                  <>
                    <div className={styles.statValue}>{fmt(affiliate?.balance_pending ?? 0)}</div>
                    <div className={styles.statSub}>Available to withdraw</div>
                  </>
                )}
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Paid Out</div>
                {loading ? (
                  <>
                    <div className={styles.skeletonValue} />
                    <div className={styles.skeletonText} />
                  </>
                ) : (
                  <>
                    <div className={styles.statValue}>{fmt(affiliate?.balance_paid ?? 0)}</div>
                    <div className={styles.statSub}>Total earned and paid</div>
                  </>
                )}
              </div>
            </div>

            <div className={styles.payoutRow}>
              {payoutResult ? (
                <div className={styles.payoutSuccess}>
                  Payout requested — {fmt(payoutResult.amount)} · ID: {payoutResult.payout_id}
                </div>
              ) : (
                <>
                  <button
                    className={styles.payoutBtn}
                    onClick={handlePayout}
                    disabled={payoutDisabled}
                  >
                    {payoutLoading ? <span className="spinner" /> : 'Request Payout'}
                  </button>
                  {payoutTooltip && (
                    <span className={styles.payoutTooltip}>{payoutTooltip}</span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Section 3: Stripe Connect ─────────────────────────────────── */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>Bank Account</p>
            {loading ? (
              <div className={styles.card}>
                <div className={styles.skeletonValue} style={{ width: '10rem', marginBottom: '0.5rem' }} />
                <div className={styles.skeletonText} style={{ width: '18rem' }} />
              </div>
            ) : affiliate?.connect_status === 'active' ? (
              <div>
                <span className={styles.connectedBadge}>
                  ✓ Bank account connected
                </span>
              </div>
            ) : (
              <div className={styles.connectCard}>
                <h3 className={styles.connectHeading}>Connect your bank account</h3>
                <p className={styles.connectBody}>
                  Connect via Stripe to receive commission payouts directly to your bank.
                </p>
                <button
                  className={styles.connectBtn}
                  onClick={handleConnect}
                  disabled={connectLoading}
                >
                  {connectLoading ? <><span className="spinner" /> Redirecting…</> : 'Connect Bank Account'}
                </button>
              </div>
            )}
          </div>

          {/* ── Section 4: Commission History ────────────────────────────── */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>Commission History</p>
            <div className={styles.card}>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Platform</th>
                      <th>Sale Amount</th>
                      <th>Your Commission</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventsLoading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <tr key={i} className={styles.skeletonRow}>
                          {Array.from({ length: 5 }).map((__, j) => (
                            <td key={j}>
                              <div className={styles.skeletonCell} style={{ width: j === 0 ? '6rem' : j === 1 ? '5rem' : j === 4 ? '4rem' : '4.5rem' }} />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : events.length === 0 ? (
                      <tr>
                        <td colSpan={5} className={styles.emptyState}>
                          No commissions yet. Share your referral link to start earning.
                        </td>
                      </tr>
                    ) : (
                      events.map((ev, i) => (
                        <tr key={i}>
                          <td>{fmtDate(ev.created_at)}</td>
                          <td>{ev.platform}</td>
                          <td>{fmt(ev.gross_amount)}</td>
                          <td>{fmt(ev.commission_amount)}</td>
                          <td>
                            <span className={ev.status === 'paid' ? styles.badgePaid : styles.badgePending}>
                              {ev.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

export default function AffiliatePage() {
  return (
    <AuthGuard>
      {(session: Session) => <AffiliateDashboard session={session} />}
    </AuthGuard>
  );
}
