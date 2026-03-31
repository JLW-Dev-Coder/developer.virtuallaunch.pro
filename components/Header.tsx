import Link from 'next/link';
import styles from './Header.module.css';

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoMark}>VLP</span>
          <div className={styles.logoText}>
            <span className={styles.logoName}>Virtual Launch Pro</span>
            <span className={styles.logoSub}>Job Match &amp; Intro Service</span>
          </div>
        </Link>

        <nav className={styles.nav}>
          <Link href="/#features" className={styles.navLink}>Features</Link>
          <Link href="/#how-it-works" className={styles.navLink}>How It Works</Link>
          <Link href="/reviews" className={styles.navLink}>Reviews</Link>
          <Link href="/support" className={styles.navLink}>Support</Link>
          <Link href="/find-developers" className={styles.navLink}>Find Developers</Link>
          <Link href="/affiliate" className={styles.navLink}>Affiliate</Link>
        </nav>

        <div className={styles.actions}>
          <Link href="/operator" className={styles.operatorBtn}>Operator Login</Link>
          <Link href="/onboarding" className={styles.ctaBtn}>Get Started</Link>
        </div>
      </div>
    </header>
  );
}
