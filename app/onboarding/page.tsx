'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Header from '@/components/Header';
import BackgroundEffects from '@/components/BackgroundEffects';
import { submitOnboarding, getOnboarding, createCheckout, getDvlpPricing, type DvlpPricing } from '@/lib/api';
import styles from './page.module.css';

function generateEventId() {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 7).toUpperCase();
  return 'VLP-' + ts + rnd;
}

const SKILLS = ['React', 'Vue', 'Angular', 'Node.js', 'Python', 'Django', 'Rails', 'Laravel',
  'TypeScript', 'JavaScript', 'GraphQL', 'PostgreSQL', 'MongoDB', 'AWS', 'Docker', 'Kubernetes', 'Go', 'Rust'];
const EXPERIENCE_LEVELS = ['1–2 years', '3–5 years', '5–8 years', '8+ years'];
const AVAILABILITY = ['Full-time', 'Part-time', 'Contract', 'Weekends only'];
const CRON_SCHEDULES = [
  { label: 'Every 3 days', value: '3' },
  { label: 'Weekly', value: '7' },
  { label: 'Every 2 weeks', value: '14' },
];

interface FormData {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  bio: string;
  skills: string[];
  experience_level: string;
  hourly_rate: string;
  availability: string;
  cronSchedule: string;
  portfolio_url: string;
}

const INIT: FormData = {
  full_name: '', email: '', phone: '', location: '', bio: '',
  skills: [], experience_level: '', hourly_rate: '', availability: '',
  cronSchedule: '7', portfolio_url: '',
};

function OnboardingContent() {
  const searchParams = useSearchParams();
  const ref = searchParams.get('ref');

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INIT);
  const [loading, setLoading] = useState(!!ref);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [eventId] = useState(() => generateEventId());
  const [pricing, setPricing] = useState<DvlpPricing | null>(null);

  useEffect(() => {
    getDvlpPricing().then(d => { if (d.ok) setPricing(d.plans); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!ref) return;
    getOnboarding(ref)
      .then(d => {
        if (d.ok && d.record) {
          const r = d.record;
          setForm(prev => ({
            ...prev,
            full_name: String(r.full_name ?? ''),
            email: String(r.email ?? ''),
            phone: String(r.phone ?? ''),
            location: String(r.location ?? ''),
            bio: String(r.bio ?? ''),
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ref]);

  function set(field: keyof FormData, value: string | string[]) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function toggleSkill(skill: string) {
    setForm(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill],
    }));
  }

  async function handleNext() {
    setError('');
    if (step === 1) {
      if (!form.full_name || !form.email) { setError('Name and email are required.'); return; }
    } else if (step === 2) {
      if (form.skills.length === 0) { setError('Select at least one skill.'); return; }
      if (!form.experience_level) { setError('Select your experience level.'); return; }
    } else if (step === 3) {
      if (!form.hourly_rate || !form.availability) { setError('Rate and availability are required.'); return; }
    }
    setStep(s => s + 1);
  }

  async function selectPlan(plan: 'free' | 'paid') {
    setError('');
    setSubmitting(true);
    try {
      const payload = { ...form, eventId, hourly_rate: Number(form.hourly_rate) };
      await submitOnboarding(payload);
      sessionStorage.setItem('vlp_ref', eventId);

      if (plan === 'free') {
        window.location.href = `/success?plan=free&ref=${encodeURIComponent(eventId)}`;
        return;
      }

      const internal = sessionStorage.getItem('vlp_internal') === 'true';
      const checkout = await createCheckout({ plan, eventId, email: form.email, internal });
      if (checkout.url) {
        window.location.href = checkout.url;
      } else {
        setError('Could not create checkout session.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className={styles.centered}>
        <div className="spinner" style={{ width: 24, height: 24 }} />
      </div>
    );
  }

  const TOTAL_STEPS = 4;

  return (
    <div className={styles.formWrap}>
      {/* Progress */}
      <div className={styles.progress}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div key={i} className={`${styles.progressStep} ${i + 1 <= step ? styles.progressActive : ''}`} />
        ))}
      </div>
      <p className={styles.stepLabel}>Step {step} of {TOTAL_STEPS}</p>

      {/* Step 1 — Personal Info */}
      {step === 1 && (
        <div className={styles.stepCard}>
          <h2 className={styles.stepTitle}>Personal Information</h2>
          <div className={styles.fields}>
            <div className={styles.row2}>
              <Field label="Full Name *">
                <input className="vlp-input field-focus" placeholder="Jane Smith" value={form.full_name}
                  onChange={e => set('full_name', e.target.value)} />
              </Field>
              <Field label="Email *">
                <input type="email" className="vlp-input field-focus" placeholder="jane@example.com"
                  value={form.email} onChange={e => set('email', e.target.value)} />
              </Field>
            </div>
            <div className={styles.row2}>
              <Field label="Phone">
                <input type="tel" className="vlp-input field-focus" placeholder="+1 (555) 000-0000"
                  value={form.phone} onChange={e => set('phone', e.target.value)} />
              </Field>
              <Field label="Location">
                <input className="vlp-input field-focus" placeholder="City, Country"
                  value={form.location} onChange={e => set('location', e.target.value)} />
              </Field>
            </div>
            <Field label="Bio">
              <textarea className="vlp-input field-focus" rows={4} placeholder="Tell clients about yourself…"
                value={form.bio} onChange={e => set('bio', e.target.value)} style={{ resize: 'vertical' }} />
            </Field>
            <Field label="Portfolio / GitHub URL">
              <input className="vlp-input field-focus" placeholder="https://github.com/you"
                value={form.portfolio_url} onChange={e => set('portfolio_url', e.target.value)} />
            </Field>
          </div>
        </div>
      )}

      {/* Step 2 — Skills */}
      {step === 2 && (
        <div className={styles.stepCard}>
          <h2 className={styles.stepTitle}>Skills &amp; Experience</h2>
          <Field label="Select your skills *">
            <div className={styles.skillsGrid}>
              {SKILLS.map(s => (
                <button type="button" key={s}
                  className={`${styles.skillChip} ${form.skills.includes(s) ? styles.skillSelected : ''}`}
                  onClick={() => toggleSkill(s)}>
                  {s}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Experience Level *">
            <div className={styles.optionRow}>
              {EXPERIENCE_LEVELS.map(l => (
                <button type="button" key={l}
                  className={`${styles.optionChip} ${form.experience_level === l ? styles.optionSelected : ''}`}
                  onClick={() => set('experience_level', l)}>
                  {l}
                </button>
              ))}
            </div>
          </Field>
        </div>
      )}

      {/* Step 3 — Availability */}
      {step === 3 && (
        <div className={styles.stepCard}>
          <h2 className={styles.stepTitle}>Availability &amp; Rate</h2>
          <div className={styles.fields}>
            <Field label="Hourly Rate (USD) *">
              <input type="number" className="vlp-input field-focus" placeholder="e.g. 75"
                value={form.hourly_rate} onChange={e => set('hourly_rate', e.target.value)} min="1" />
            </Field>
            <Field label="Availability *">
              <div className={styles.optionRow}>
                {AVAILABILITY.map(a => (
                  <button type="button" key={a}
                    className={`${styles.optionChip} ${form.availability === a ? styles.optionSelected : ''}`}
                    onClick={() => set('availability', a)}>
                    {a}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Notification Frequency">
              <div className={styles.optionRow}>
                {CRON_SCHEDULES.map(c => (
                  <button type="button" key={c.value}
                    className={`${styles.optionChip} ${form.cronSchedule === c.value ? styles.optionSelected : ''}`}
                    onClick={() => set('cronSchedule', c.value)}>
                    {c.label}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </div>
      )}

      {/* Step 4 — Plan Selection */}
      {step === 4 && (
        <div className={styles.stepCard}>
          <h2 className={styles.stepTitle}>Choose Your Plan</h2>
          <p className={styles.stepSub}>Start free anytime. Upgrade to unlock curated matches and a 1-on-1 intro consult.</p>
          <div className={styles.planGrid}>
            {/* Free Plan */}
            <div className={styles.planCard}>
              <div className="future-eyebrow" style={{ marginBottom: '0.5rem' }}>
                {pricing?.free.name ?? 'Free'}
              </div>
              <div className={styles.planPrice}>Free</div>
              <p className={styles.planDesc}>Get listed and start receiving client inquiries.</p>
              <ul className={styles.planFeatures}>
                {(pricing?.free.features ?? ['Profile listing', 'Receive & respond to inquiries', 'Basic support']).map(f => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <button className={styles.planBtnSecondary} onClick={() => selectPlan('free')}
                disabled={submitting}>
                {submitting ? <span className="spinner" /> : (pricing?.free.cta ?? 'Get Listed Free')}
              </button>
            </div>
            {/* Paid Plan */}
            <div className={`${styles.planCard} ${styles.planFeatured}`}>
              <div className={styles.popularBadge}>Most Popular</div>
              <div className="future-eyebrow" style={{ marginBottom: '0.5rem' }}>
                {pricing?.paid.name ?? 'Intro Track'}
              </div>
              <div className={styles.planPrice}>
                ${pricing?.paid.price.toFixed(2) ?? '2.99'}
                <span className={styles.planPer}>/{pricing?.paid.interval ?? 'mo'}</span>
              </div>
              <p className={styles.planDesc}>Curated job matches, featured placement, and a 1-on-1 intro consult.</p>
              <ul className={styles.planFeatures}>
                {(pricing?.paid.features ?? [
                  'Everything in Free',
                  'Curated job matches',
                  'Featured profile placement',
                  '1-on-1 intro consultation',
                ]).map(f => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <button className={styles.planBtnPrimary} onClick={() => selectPlan('paid')}
                disabled={submitting}>
                {submitting ? <span className="spinner" /> : (pricing?.paid.cta ?? 'Start Intro Track — $2.99/mo')}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <div className={styles.errorMsg}>{error}</div>}

      {step < 4 && (
        <div className={styles.navRow}>
          {step > 1 && (
            <button className={styles.backBtn} onClick={() => setStep(s => s - 1)}>← Back</button>
          )}
          <button className={styles.nextBtn} onClick={handleNext}>
            {step === 3 ? 'Choose Plan →' : 'Next →'}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#cbd5e1' }}>{label}</label>
      {children}
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <BackgroundEffects beacon />
      <Header />
      <main style={{ flex: 1, padding: '3rem 1.5rem', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: '42rem', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.75rem' }}>
              Join Virtual Launch Pro
            </h1>
            <p style={{ fontSize: '1.125rem', color: '#94a3b8' }}>
              Get matched with premium U.S. clients. Set your rates. Work on your terms.
            </p>
          </div>
          <Suspense fallback={<div className={styles.centered}><div className="spinner" style={{ width: 24, height: 24 }} /></div>}>
            <OnboardingContent />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
