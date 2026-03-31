'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BackgroundEffects from '@/components/BackgroundEffects';
import { getDvlpPricing, type DvlpPricing } from '@/lib/api';

const FALLBACK: DvlpPricing = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    features: ['Profile listing', 'Receive & respond to inquiries', 'Basic support'],
    cta: 'Get Listed Free',
  },
  paid: {
    id: 'paid',
    name: 'Intro Track',
    price: 2.99,
    interval: 'mo',
    features: [
      'Everything in Free',
      'Curated job matches',
      'Featured profile placement',
      '1-on-1 intro consultation',
    ],
    cta: 'Start Intro Track',
  },
};

export default function PricingPage() {
  const [pricing, setPricing] = useState<DvlpPricing>(FALLBACK);

  useEffect(() => {
    getDvlpPricing().then(d => { if (d.ok && d.plans) setPricing(d.plans); }).catch(() => {});
  }, []);

  const free = pricing.free;
  const paid = pricing.paid;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <BackgroundEffects beacon />
      <Header />
      <main style={{ flex: 1, padding: '4rem 1.5rem', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: '56rem', margin: '0 auto' }}>
          {/* Heading */}
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Pricing</p>
            <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', fontWeight: 700, color: '#f1f5f9', marginBottom: '1rem' }}>
              Simple, transparent plans
            </h1>
            <p style={{ fontSize: '1.125rem', color: '#94a3b8', maxWidth: '36rem', margin: '0 auto' }}>
              Start free and get listed today. Upgrade to Intro Track when you&apos;re ready for curated matches and a dedicated intro call.
            </p>
          </div>

          {/* Plan cards */}
          <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginBottom: '3rem' }}>
            {/* Free card */}
            <div style={{
              position: 'relative', borderRadius: '1rem',
              border: '1px solid rgba(51,65,85,.5)', background: 'rgba(15,23,42,.5)',
              padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem',
            }}>
              <div>
                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.375rem' }}>{free.name}</p>
                <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#f1f5f9' }}>Free</div>
                <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.5rem' }}>Get listed and start receiving inquiries — no credit card needed.</p>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                {free.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', fontSize: '0.875rem', color: '#cbd5e1' }}>
                    <span style={{ color: '#10b981', fontWeight: 700, flexShrink: 0 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/onboarding" style={{
                display: 'block', textAlign: 'center', padding: '0.875rem',
                borderRadius: '0.5rem', border: '1px solid rgba(51,65,85,.6)',
                background: 'transparent', color: '#94a3b8', fontWeight: 600,
                fontSize: '0.9rem', textDecoration: 'none', transition: 'all 0.2s',
              }}>
                {free.cta}
              </Link>
            </div>

            {/* Paid card */}
            <div style={{
              position: 'relative', borderRadius: '1rem',
              border: '1px solid rgba(16,185,129,.35)', background: 'rgba(16,185,129,.04)',
              padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem',
              boxShadow: '0 0 40px rgba(16,185,129,.08)',
            }}>
              {/* Popular badge */}
              <div style={{
                position: 'absolute', top: '-0.875rem', left: '50%', transform: 'translateX(-50%)',
                background: 'linear-gradient(135deg, #10b981, #059669)', color: '#020617',
                fontSize: '0.65rem', fontWeight: 700, padding: '0.3rem 0.875rem',
                borderRadius: 9999, whiteSpace: 'nowrap',
              }}>
                Most Popular
              </div>
              <div>
                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.375rem' }}>{paid.name}</p>
                <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#f1f5f9' }}>
                  ${paid.price.toFixed(2)}
                  <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 400 }}>/{paid.interval ?? 'mo'}</span>
                </div>
                <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.5rem' }}>Curated matches, featured placement, and a personal intro call.</p>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                {paid.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', fontSize: '0.875rem', color: '#cbd5e1' }}>
                    <span style={{ color: '#10b981', fontWeight: 700, flexShrink: 0 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/onboarding" style={{
                display: 'block', textAlign: 'center', padding: '0.875rem',
                borderRadius: '0.5rem',
                background: 'linear-gradient(135deg, #10b981, #059669)', color: '#020617',
                fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none',
                transition: 'all 0.2s', boxShadow: '0 4px 16px rgba(16,185,129,.25)',
              }}>
                {paid.cta}
              </Link>
            </div>
          </div>

          {/* Feature comparison table */}
          <div style={{
            borderRadius: '1rem', border: '1px solid rgba(51,65,85,.5)',
            background: 'rgba(15,23,42,.4)', overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(51,65,85,.5)' }}>
                  <th style={{ textAlign: 'left', padding: '1rem 1.5rem', color: '#64748b', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Feature</th>
                  <th style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontWeight: 600 }}>Free</th>
                  <th style={{ textAlign: 'center', padding: '1rem', color: '#10b981', fontWeight: 600 }}>Intro Track</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Profile listing', free: true, paid: true },
                  { label: 'Receive & respond to inquiries', free: true, paid: true },
                  { label: 'Basic support', free: true, paid: true },
                  { label: 'Featured profile placement', free: false, paid: true },
                  { label: 'Curated job matches', free: false, paid: true },
                  { label: 'Weekly match notifications', free: false, paid: true },
                  { label: '1-on-1 intro consultation', free: false, paid: true },
                ].map((row, i) => (
                  <tr key={row.label} style={{ borderBottom: i < 6 ? '1px solid rgba(51,65,85,.3)' : 'none' }}>
                    <td style={{ padding: '0.875rem 1.5rem', color: '#cbd5e1' }}>{row.label}</td>
                    <td style={{ textAlign: 'center', padding: '0.875rem 1rem' }}>
                      {row.free
                        ? <span style={{ color: '#10b981', fontSize: '1rem' }}>✓</span>
                        : <span style={{ color: '#334155', fontSize: '1rem' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'center', padding: '0.875rem 1rem' }}>
                      {row.paid
                        ? <span style={{ color: '#10b981', fontSize: '1rem' }}>✓</span>
                        : <span style={{ color: '#334155', fontSize: '1rem' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CTA footer */}
          <div style={{ textAlign: 'center', marginTop: '3rem' }}>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Questions? <a href="https://t.me/virtuallaunchpro" target="_blank" rel="noopener noreferrer" style={{ color: '#10b981', textDecoration: 'none' }}>Reach us on Telegram</a> or call <a href="tel:+16198005457" style={{ color: '#10b981', textDecoration: 'none' }}>+1 (619) 800-5457</a>.
            </p>
            <Link href="/onboarding" style={{
              display: 'inline-block', padding: '0.875rem 2.5rem',
              background: 'linear-gradient(135deg, #10b981, #059669)', color: '#020617',
              fontWeight: 700, fontSize: '1rem', borderRadius: '0.5rem',
              textDecoration: 'none', boxShadow: '0 4px 20px rgba(16,185,129,.25)',
            }}>
              Get Started →
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
