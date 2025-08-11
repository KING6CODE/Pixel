// components/BackgroundParticles.js
import { useEffect, useRef } from 'react';

export default function ParticlesBackground({ color = '#60a5fa', density = 70 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    let width = (c.width = window.innerWidth);
    let height = (c.height = window.innerHeight);
    let raf = null;

    const particles = Array.from({ length: density }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 0.6 + Math.random() * 1.6,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      alpha: 0.04 + Math.random() * 0.12,
    }));

    function draw() {
      ctx.clearRect(0, 0, width, height);
      // subtle gradient overlay behind particles
      const g = ctx.createLinearGradient(0, 0, width, height);
      g.addColorStop(0, 'rgba(6,11,34,0.25)');
      g.addColorStop(1, 'rgba(9,17,56,0.25)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

      // draw particles
      ctx.fillStyle = color;
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.globalAlpha = p.alpha;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    function update() {
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;
      });
      draw();
      raf = requestAnimationFrame(update);
    }

    update();

    function onResize() {
      width = c.width = window.innerWidth;
      height = c.height = window.innerHeight;
    }
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [color, density]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        width: '100vw',
        height: '100vh',
      }}
    />
  );
}

