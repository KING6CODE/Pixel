// pages/galerie.js
import Link from 'next/link';
import ParticlesBackground from '../components/ParticlesBackground';
import styles from '../styles/grid.module.css';
import { useEffect, useState } from 'react';

export default function Galerie() {
  const total = 10 * 10;
  const [pixels, setPixels] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('pixel_grid_v1');
        if (raw) return JSON.parse(raw);
      }
    } catch (e) {}
    // default blank if none
    return Array.from({ length: total }).map(()=> ({ color: '#ffffff', price: 1 }));
  });

  // keep in sync if localStorage changes (optionally)
  useEffect(()=>{
    function onStorage() {
      try {
        const raw = localStorage.getItem('pixel_grid_v1');
        if(raw) setPixels(JSON.parse(raw));
      } catch(e){}
    }
    window.addEventListener('storage', onStorage);
    return ()=> window.removeEventListener('storage', onStorage);
  },[]);

  return (
    <div className="app-shell">
      <ParticlesBackground color="#a78bfa" density={60} />
      <div style={{ width: '100%', maxWidth: 1100, padding: 20 }}>
        <header style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <div>
            <h1 style={{ color:'#e8f0ff' }}>Galerie — Aperçu sans prix</h1>
            <p style={{ color:'rgba(232,240,255,0.8)' }}>Appuie sur les créations: coins arrondis, prix masqués — parfait pour exposer.</p>
          </div>
          <div style={{ display:'flex', gap:12 }}>
            <Link href="/" legacyBehavior><a style={{ color:'#e8f0ff', textDecoration:'underline', fontWeight:700 }}>Retour</a></Link>
          </div>
        </header>

        <div style={{ background:'rgba(255,255,255,0.02)', padding:18, borderRadius:12 }}>
          <div className={styles.grid} style={{ gap: 8 }}>
            {pixels.map((p, i) => (
              <div key={i} style={{
                width: 56, height:56, borderRadius:16,
                background: p.color, boxShadow:'0 10px 20px rgba(2,6,22,0.25)',
                border: '1px solid rgba(255,255,255,0.03)'
              }} aria-hidden />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
