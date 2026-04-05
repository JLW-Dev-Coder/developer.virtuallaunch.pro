import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BackgroundEffects from '@/components/BackgroundEffects';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Support — Virtual Launch Pro',
  description: 'Get answers to common questions about DVLP, contact our team, or schedule a call.',
};

const faqs = [
  {
    q: 'What is DVLP and how does it work?',
    a: 'DVLP (Developers VLP) is a developer marketplace that matches freelance developers with vetted U.S. clients. You create a profile, choose a plan, and we connect you with projects that fit your skills and availability.',
  },
  {
    q: 'How much does it cost to join?',
    a: 'We offer a Free plan that gets you listed in the developer directory, and an Intro Track plan at $2.99/mo that includes priority matching, a 1-on-1 intro call, and featured placement. See our <a href="/pricing">pricing page</a> for full details.',
  },
  {
    q: 'How do I get matched with clients?',
    a: 'Once your profile is live, businesses can find you through our directory or submit a request on our <a href="/find-developers">Find Developers</a> page. We review each request and match it with developers whose skills and rates align.',
  },
  {
    q: 'Can I set my own rates and choose my projects?',
    a: 'Yes. You set your hourly rate during onboarding and you are free to accept or decline any project introduction. There are no exclusivity requirements.',
  },
  {
    q: 'What happens after I sign up?',
    a: 'Free plan members appear in the developer directory immediately. Intro Track members also get a scheduled 1-on-1 call to refine their profile and receive priority introductions to matching projects.',
  },
  {
    q: 'How do I cancel or change my plan?',
    a: 'Contact us via any of the options below and we will update or cancel your subscription immediately. There are no long-term contracts.',
  },
];

export default function SupportPage() {
  return (
    <div className={styles.app}>
      <BackgroundEffects />
      <Header />
      <main className={styles.main}>
        <div className={styles.inner}>
          <div className={styles.heroHead}>
            <div className={styles.iconWrap}>
              <svg viewBox="0 0 24 24" fill="white" width="28" height="28">
                <path d="M11.5 2C6.81 2 3 5.81 3 10.5S6.81 19 11.5 19h.5v3c4.86-2.34 8-7 8-11.5C20 5.81 16.19 2 11.5 2zm1 14.5h-2v-2h2v2zm0-3.5h-2c0-3.25 3-3 3-5 0-1.1-.9-2-2-2s-2 .9-2 2h-2c0-2.21 1.79-4 4-4s4 1.79 4 4c0 2.5-3 2.75-3 5z" />
              </svg>
            </div>
            <h1 className={styles.title}>Support</h1>
            <p className={styles.sub}>Find answers or reach out — we are here to help.</p>
          </div>

          <section className={styles.faqSection}>
            <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
            {faqs.map((faq, i) => (
              <div key={i} className={styles.faqItem} style={{ animationDelay: `${i * 0.08}s` }}>
                <h3 className={styles.faqQuestion}>{faq.q}</h3>
                <p className={styles.faqAnswer} dangerouslySetInnerHTML={{ __html: faq.a }} />
              </div>
            ))}
          </section>

          <section className={styles.contactSection}>
            <h2 className={styles.sectionTitle}>Contact Us</h2>
            <div className={styles.contactGrid}>
              <a href="https://cal.com/virtuallaunchpro/intro" target="_blank" rel="noopener noreferrer" className={styles.contactCard}>
                <div className={styles.contactIconWrap}>
                  <svg viewBox="0 0 24 24" fill="#10b981" width="20" height="20">
                    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
                  </svg>
                </div>
                <div>
                  <div className={styles.contactLabel}>Schedule a Call</div>
                  <div className={styles.contactDetail}>Book a free intro call on Cal.com</div>
                </div>
              </a>
              <a href="mailto:team@virtuallaunch.pro" className={styles.contactCard}>
                <div className={styles.contactIconWrap}>
                  <svg viewBox="0 0 24 24" fill="#10b981" width="20" height="20">
                    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                  </svg>
                </div>
                <div>
                  <div className={styles.contactLabel}>Email</div>
                  <div className={styles.contactDetail}>team@virtuallaunch.pro</div>
                </div>
              </a>
              <a href="https://t.me/virtuallaunchpro" target="_blank" rel="noopener noreferrer" className={styles.contactCard}>
                <div className={styles.contactIconWrap}>
                  <svg viewBox="0 0 24 24" fill="#10b981" width="20" height="20">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                  </svg>
                </div>
                <div>
                  <div className={styles.contactLabel}>Telegram</div>
                  <div className={styles.contactDetail}>@virtuallaunchpro</div>
                </div>
              </a>
              <a href="tel:+16198005457" className={styles.contactCard}>
                <div className={styles.contactIconWrap}>
                  <svg viewBox="0 0 24 24" fill="#10b981" width="20" height="20">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                  </svg>
                </div>
                <div>
                  <div className={styles.contactLabel}>Phone</div>
                  <div className={styles.contactDetail}>+1 (619) 800-5457</div>
                </div>
              </a>
            </div>
          </section>
        </div>
      </main>

      <section className={styles.ctaSection}>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>Find developers who specialize in exactly what you need</h2>
          <p className={styles.ctaSub}>Tell us your project requirements and we will match you with a vetted developer from our network.</p>
          <div className={styles.ctaButtons}>
            <a href="/find-developers" className={styles.ctaPrimary}>Find a Developer</a>
            <a href="/pricing" className={styles.ctaSecondary}>View Pricing</a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
