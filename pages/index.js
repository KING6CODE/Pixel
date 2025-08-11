// pages/index.js
import Link from 'next/link';
import ParticlesBackground from '../components/ParticlesBackground';
import styles from '../styles/Home.module.css';

export default function Home() {
  return (
    <>
      <ParticlesBackground color="#7cc4ff" density={80} />
      <main className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.logo}>PixelProfit</h1>
          <nav>
            <Link href="/game"><a className={styles.cta}>Acheter un pixel</a></Link>
          </nav>
        </header>
        <section className={styles.hero}>
          <h2>Transformez chaque pixel en profit.</h2>
          <p>
            Achetez, personnalisez et vendez des pixels sur notre grille unique. Gagnez de l'argent rapidement grâce à vos pixels.
          </p>
          <Link href="/game">
            <a className={styles.ctaLarge}>Commencer à gagner</a>
          </Link>
        </section>
        <section className={styles.features}>
          <div className={styles.feature}>
            <h3>Simple & Rapide</h3>
            <p>Achetez vos pixels en quelques clics, personnalisez-les facilement.</p>
          </div>
          <div className={styles.feature}>
            <h3>100% Visuel</h3>
            <p>Une interface épurée et intuitive, idéale pour tous les utilisateurs.</p>
          </div>
          <div className={styles.feature}>
            <h3>Potentiel de gain</h3>
            <p>Vendez vos pixels à profit quand vous le souhaitez.</p>
          </div>
        </section>
        <footer className={styles.footer}>
          <small>© 2025 PixelProfit - Tous droits réservés.</small>
        </footer>
      </main>
    </>
  );
}
