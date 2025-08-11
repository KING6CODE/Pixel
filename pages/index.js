// pages/index.js
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import ParticlesBackground from '../components/BackgroundParticles';
import styles from '../styles/grid.module.css';

const GRID_SIZE = 10;
const START_PRICE = 1;

function getBorderKey(price) {
  if (price < 2) return 'borderPrice1';
  if (price < 4) return 'borderPrice2';
  if (price < 8) return 'borderPrice4';
  if (price < 16) return 'borderPrice8';
  return 'borderPrice16';
}
function hslToCss(h,s,l){ return `hsl(${h} ${s}% ${l}%)`; }

export default function Home() {
  const total = GRID_SIZE * GRID_SIZE;

  // pixels state stored in localStorage for persistence
  const [pixels, setPixels] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('pixel_grid_v1');
        if (raw) return JSON.parse(raw);
      }
    } catch (e) {}
    return Array.from({ length: total }).map(() => ({ color: '#ffffff', price: START_PRICE }));
  });

  useEffect(() => {
    try {
      localStorage.setItem('pixel_grid_v1', JSON.stringify(pixels));
    } catch (e) {}
  }, [pixels]);

  // drawer states
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerIndex, setDrawerIndex] = useState(null);

  // HSL sliders for preview
  const [h, setH] = useState(210);
  const [s, setS] = useState(80);
  const [l, setL] = useState(60);
  const preview = useMemo(()=> hslToCss(h,s,l), [h,s,l]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [introOpen, setIntroOpen] = useState(true);
  const containerRef = useRef(null);

  // open drawer for index
  function openDrawer(i) {
    const cur = pixels[i]?.color || '#ffffff';
    // parse HSL if possible
    const m = /hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/.exec(cur);
    if (m) {
      setH(Number(m[1])); setS(Number(m[2])); setL(Number(m[3]));
    }
    setDrawerIndex(i);
    setDrawerOpen(true);
  }
  function closeDrawer() {
    setDrawerOpen(false);
    setDrawerIndex(null);
  }

  // validate: apply color and double price
  function validate() {
    if (drawerIndex == null) return;
    setIsProcessing(true);
    setTimeout(()=>{
      setPixels(prev=>{
        const next = [...prev];
        const cur = next[drawerIndex];
        const newPrice = Math.min(cur.price * 2, 2**12); // cap huge growth
        next[drawerIndex] = { color: preview, price: newPrice };
        return next;
      });
      setIsProcessing(false);
      closeDrawer();
    }, 200);
  }

  // reset all
  function resetAll(){
    if (!confirm('Réinitialiser tous les pixels et prix à 1€ ?')) return;
    setPixels(Array.from({ length: total }).map(()=> ({ color:'#ffffff', price: START_PRICE })));
    setDrawerOpen(false);
    setDrawerIndex(null);
  }

  // purchased count and progress percent
  const purchasedCount = pixels.filter(p => p.price > START_PRICE).length;
  const progressPercent = Math.round((purchasedCount / total) * 100);

  // keyboard escape closes drawer
  useEffect(()=>{
    function onKey(e){ if(e.key === 'Escape') closeDrawer(); }
    window.addEventListener('keydown', onKey);
    return ()=> window.removeEventListener('keydown', onKey);
  },[]);

  // simple click sound (optional): base64 tiny click
  const clickAudioRef = useRef(null);
  useEffect(()=>{
    try {
      clickAudioRef.current = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=');
    } catch(e){}
  },[]);

  // play audio when validate
  useEffect(()=>{
    if (!isProcessing) return;
    try { clickAudioRef.current?.play(); } catch(e){}
  },[isProcessing]);

  return (
    <div className="app-shell">
      <ParticlesBackground color="#60a5fa" density={70} />

      {introOpen && (
        <div className={styles.introOverlay} role="dialog" aria-modal="true">
          <div className={styles.introCard}>
            <h2>Bienvenue sur Pixel Market</h2>
            <p>Grille 10×10 — chaque pixel commence à <strong>1€</strong>. Cliquez sur un pixel pour personnaliser sa couleur. À chaque validation le prix double (1 → 2 → 4 → 8 → 16 → ...). Les contours changent selon le palier de prix. Ici tout reste côté frontend (pas de paiement).</p>
            <p>Tu pourras ensuite ouvrir <strong>/galerie</strong> pour voir le dessin final sans prix ni contours — parfait pour exposer les créations.</p>
            <div className="introActions" style={{display:'flex', justifyContent:'flex-end'}}>
              <button className={styles['ghostBtn']} onClick={()=> setIntroOpen(false)}>Entrer</button>
            </div>
          </div>
        </div>
      )}

      <main className={styles.page} ref={containerRef}>
        <div className={styles.header}>
          <div>
            <div className={styles.title}>Pixel Market — 10×10</div>
            <div className={styles.subtitle}>Clique sur n’importe quel pixel pour personnaliser sa couleur.</div>
          </div>

          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            <div style={{ textAlign:'right', fontSize:13, color:'rgba(232,240,255,0.85)' }}>
              <div>Progression: <strong>{purchasedCount}/{total}</strong></div>
              <div style={{ marginTop:6, width:180 }}>
                <div style={{ background:'rgba(255,255,255,0.04)', height:10, borderRadius:8, overflow:'hidden' }}>
                  <div style={{ height: '100%', width: `${progressPercent}%`, background:'linear-gradient(90deg,#f5c27a,#7cc4ff)' }} />
                </div>
              </div>
            </div>

            <Link href="/galerie" legacyBehavior><a style={{ color:'#e8f0ff', textDecoration:'underline', fontWeight:700 }}>Galerie</a></Link>

            <button className={styles.primaryBtn} onClick={resetAll}>Réinitialiser tout</button>
          </div>
        </div>

        {/* left column */}
        <section className={styles.left}>
          <div className={styles.gridWrap}>
            <div className={styles.grid} role="grid" aria-label="Grille 10 par 10">
              {pixels.map((p, i) => {
                const borderKey = getBorderKey(p.price);
                const borderClass = styles[ borderKey ] || '';
                const glowClass = p.price >= 16 ? styles.glow : '';
                return (
                  <button
                    key={i}
                    onClick={() => openDrawer(i)}
                    className={`${styles.pixel} ${borderClass} ${glowClass}`}
                    aria-label={`Pixel ${i+1}, prix ${p.price} euro`}
                    style={{ background: p.color }}
                  >
                    <span className="price">{p.price}€</span>
                    {p.price > START_PRICE && <span className="boughtBadge">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.legend} aria-hidden>
            <div className={styles.legendItem}><div style={{width:12,height:12,background:'#d1d5db',borderRadius:4}}></div><div style={{fontSize:13}}>1€ — contour gris</div></div>
            <div className={styles.legendItem}><div style={{width:12,height:12,background:'#86efac',borderRadius:4}}></div><div style={{fontSize:13}}>2€ — vert</div></div>
            <div className={styles.legendItem}><div style={{width:12,height:12,background:'#93c5fd',borderRadius:4}}></div><div style={{fontSize:13}}>4€ — bleu</div></div>
            <div className={styles.legendItem}><div style={{width:12,height:12,background:'#c4b5fd',borderRadius:4}}></div><div style={{fontSize:13}}>8€ — violet</div></div>
            <div className={styles.legendItem}><div style={{width:12,height:12,background:'#ffd580',borderRadius:4, boxShadow:'0 0 8px rgba(255,213,130,0.4)'}}></div><div style={{fontSize:13}}>16€+ — doré</div></div>
          </div>
        </section>

        {/* right column (static panel) */}
        <aside className={styles.panel} aria-hidden>
          <h3>Infos</h3>
          <p style={{ color:'rgba(232,240,255,0.86)' }}>
            Clique sur un pixel pour l’éditer. Dans le drawer tu pourras choisir la couleur via sliders H / S / L et valider pour appliquer la couleur et doubler le prix.
          </p>
          <div style={{ marginTop:12 }}>
            <strong>Astuce :</strong>
            <ul style={{ color:'rgba(232,240,255,0.8)', marginTop:8 }}>
              <li>Utilise la palette H/S/L pour des dégradés harmonieux.</li>
              <li>La galerie montre la grille sans prix — idéale pour exposer.</li>
            </ul>
          </div>
        </aside>
      </main>

      {/* overlay */}
      <div className={`${styles.drawerOverlay} ${drawerOpen ? styles.drawerOverlayVisible : ''}`} onClick={closeDrawer} />

      {/* drawer */}
      <div className={`${styles.drawer} ${drawerOpen ? styles.drawerOpen : ''}`} role="dialog" aria-modal="true" aria-hidden={!drawerOpen}>
        <div className={styles.drawerHeader}>
          <div>
            <div className={styles.drawerTitle}>{drawerIndex != null ? `Pixel #${drawerIndex+1}` : 'Éditer pixel'}</div>
            <div className={styles.drawerSub}>Prix actuel: {drawerIndex != null ? pixels[drawerIndex].price+'€' : '--'}</div>
          </div>
          <div>
            <button className={styles.ghostBtn} onClick={closeDrawer}>X</button>
          </div>
        </div>

        <div style={{ marginTop:6 }}>
          <div className={styles.colorPreview} style={{ background: preview }} />
          <div className={styles.sliderRow}>
            <label>Hue</label>
            <input type="range" min="0" max="360" value={h} onChange={(e)=> setH(Number(e.target.value))}/>
            <div style={{ width:40, textAlign:'right' }}>{h}</div>
          </div>
          <div className={styles.sliderRow}>
            <label>Sat</label>
            <input type="range" min="0" max="100" value={s} onChange={(e)=> setS(Number(e.target.value))}/>
            <div style={{ width:40, textAlign:'right' }}>{s}%</div>
          </div>
          <div className={styles.sliderRow}>
            <label>Light</label>
            <input type="range" min="0" max="100" value={l} onChange={(e)=> setL(Number(e.target.value))}/>
            <div style={{ width:40, textAlign:'right' }}>{l}%</div>
          </div>

          <div style={{ marginTop:8, color:'rgba(232,240,255,0.9)', fontSize:13 }}>
            Aperçu: <code style={{ background:'rgba(255,255,255,0.03)', padding:'2px 6px', borderRadius:6 }}>{preview}</code>
          </div>

          <div className={styles.btnRow}>
            <button className={styles.primaryBtn} onClick={validate} disabled={isProcessing}>{isProcessing ? 'En cours...' : 'Valider (double prix)'}</button>
            <button className={styles.ghostBtn} onClick={closeDrawer}>Annuler</button>
          </div>

          <div style={{ marginTop:12 }}>
            <small style={{ color:'rgba(232,240,255,0.6)' }}>Les changements sont locaux (frontend).</small>
          </div>
        </div>
      </div>
    </div>
  );
}



