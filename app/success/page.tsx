'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BackgroundEffects from '@/components/BackgroundEffects';
import { getSessionStatus } from '@/lib/api';
import styles from './page.module.css';

type PaymentState = 'processing' | 'completed' | 'error';

function SuccessContent() {
  const searchParams = useSearchParams();
  const session_id = searchParams.get('session_id');
  const plan_param = searchParams.get('plan');
  const ref_param = searchParams.get('ref');

  const [state, setState] = useState<PaymentState>('processing');
  const [plan, setPlan] = useState<string | null>(null);
  const [ref, setRef] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Free plan path — no Stripe session required
    if (plan_param === 'free' && ref_param) {
      setPlan('free');
      setRef(ref_param);
      sessionStorage.setItem('vlp_ref', ref_param);
      localStorage.setItem('vlp_current_plan', 'free');
      setState('completed');
      return;
    }

    if (!session_id) {
      setState('error');
      setErrorMsg('No session ID found. Please return to onboarding and try again.');
      return;
    }

    const INTERVAL = 2000;
    const TIMEOUT = 30000;
    const start = Date.now();

    async function poll() {
      try {
        const data = await getSessionStatus(session_id!);
        if (!data.ok) {
          setState('error');
          setErrorMsg('Could not verify payment status. Please contact support.');
          return true;
        }
        if (data.status === 'completed') {
          setPlan(data.plan ?? null);
          const vlpRef = data.vlp_ref ?? null;
          setRef(vlpRef);
          if (vlpRef) sessionStorage.setItem('vlp_ref', vlpRef);
          if (data.plan) localStorage.setItem('vlp_current_plan', data.plan);
          setState('completed');
          return true;
        }
        if (data.status === 'error') {
          setState('error');
          setErrorMsg('Payment could not be confirmed. Please try again or contact support.');
          return true;
        }
        if (Date.now() - start >= TIMEOUT) {
          setState('error');
          setErrorMsg('Confirmation timed out. Your payment may still be processing — check your email.');
          return true;
        }
        return false;
      } catch {
        return false;
      }
    }

    let timer: ReturnType<typeof setInterval>;
    poll().then(done => {
      if (!done) {
        timer = setInterval(() => {
          poll().then(d => { if (d) clearInterval(timer); });
        }, INTERVAL);
      }
    });

    return () => clearInterval(timer);
  }, [session_id, plan_param, ref_param]);

  async function copyRef() {
    if (!ref) return;
    await navigator.clipboard.writeText(ref);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={styles.inner}>
      {state === 'processing' && (
        <div className={styles.processingState}>
          <div className={styles.spinner} />
          <p className={styles.processingText}>Confirming your plan…</p>
          <p className={styles.processingHint}>This may take a few seconds.</p>
        </div>
      )}

      {state === 'completed' && (
        <>
          <div className={styles.successIcon}>
            <svg viewBox="0 0 24 24" fill="white" width="40" height="40">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </div>
          <h1 className={styles.title}>
            {plan === 'paid' ? "You're all set! Welcome to Intro Track." : "You're listed! Welcome to DVLP."}
          </h1>
          <p className={styles.sub}>
            {plan === 'paid'
              ? "Schedule your 1-on-1 intro consultation below. We'll follow up within 24 hours with your first curated matches."
              : "Your profile is live. We'll reach out when a matching opportunity comes in. Check your email for next steps."}
          </p>

          {ref && (
            <div className={styles.refSection}>
              <p className={styles.refLabel}>Your Reference Number</p>
              <div className={styles.refBox}>
                <span className={styles.refNumber}>{ref}</span>
                <button className={`${styles.copyBtn} ${copied ? styles.copyBtnCopied : ''}`} onClick={copyRef}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
                  </svg>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className={styles.refHint}>
                Save this number — use it on the <Link href="/support" className={styles.refLink}>Support page</Link> to check your application status.
              </p>
            </div>
          )}

          {plan === 'paid' ? (
            <div className={styles.actions}>
              <a
                href="https://cal.com/tax-monitor-pro/developers-virtual-launch-pro-onboarding"
                target="_blank" rel="noopener noreferrer"
                className={styles.calBtn}>
                Schedule Your 1-on-1 Intro Call
              </a>
              <Link href="/" className={styles.homeBtn}>Return to Home</Link>
            </div>
          ) : (
            <>
              <div className={styles.actions}>
                <Link href="/" className={styles.homeBtn}>Return to Home</Link>
              </div>
              <div className={styles.upgradeCard}>
                <p className={styles.upgradeEyebrow}>Want more?</p>
                <h2 className={styles.upgradeTitle}>Unlock curated job matches &amp; a 1-on-1 intro consultation</h2>
                <p className={styles.upgradeSub}>Upgrade to Intro Track for $2.99/mo — featured placement, weekly matches, and a dedicated intro call.</p>
                <Link href="/pricing" className={styles.upgradeBtn}>See Intro Track →</Link>
              </div>
            </>
          )}

          <div className={styles.contactCard}>
            <h2 className={styles.contactTitle}>Questions? Get in Touch</h2>
            <div className={styles.contactGrid}>
              <div className={styles.contactItem}>
                <span className={styles.contactLabel}>Telegram</span>
                <a href="https://t.me/virtuallaunchpro" target="_blank" rel="noopener noreferrer" className={styles.contactLink}>@virtuallaunchpro</a>
              </div>
              <div className={styles.contactItem}>
                <span className={styles.contactLabel}>Phone</span>
                <a href="tel:+16198005457" className={styles.contactLink}>+1 (619) 800-5457</a>
              </div>
              <div className={styles.contactItem}>
                <span className={styles.contactLabel}>LinkedIn</span>
                <a href="https://www.linkedin.com/in/virtuallaunchpro/" target="_blank" rel="noopener noreferrer" className={styles.contactLink}>virtuallaunchpro</a>
              </div>
              <div className={styles.contactItem}>
                <span className={styles.contactLabel}>Facebook</span>
                <a href="https://www.facebook.com/jamie.l.williams.10" target="_blank" rel="noopener noreferrer" className={styles.contactLink}>Jamie L. Williams</a>
              </div>
            </div>
          </div>
        </>
      )}

      {state === 'error' && (
        <>
          <h1 className={styles.errorTitle}>Payment could not be confirmed</h1>
          <p className={styles.errorMsg}>{errorMsg}</p>
          <div className={styles.actions}>
            <Link href="/" className={styles.homeBtn}>Return to Home</Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function SuccessPage() {
  return (
    <div className={styles.app}>
      <BackgroundEffects />
      <Header />
      <main className={styles.main}>
        <Suspense fallback={
          <div className={styles.inner}>
            <div className={styles.processingState}>
              <div className={styles.spinner} />
            </div>
          </div>
        }>
          <SuccessContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
