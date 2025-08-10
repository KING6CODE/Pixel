import React, { useEffect, useRef } from "react";

export default function BackgroundParticles() {
  const canvasRef = useRef(null);
  const particles = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    function Particle() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.radius = 1 + Math.random() * 2;
      this.speedX = (Math.random() - 0.5) * 0.3;
      this.speedY = (Math.random() - 0.5) * 0.3;
      this.alpha = 0.5 + Math.random() * 0.5;
    }

    Particle.prototype.draw = function () {
      ctx.beginPath();
      ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
      ctx.shadowColor = "rgba(255,255,255,0.7)";
      ctx.shadowBlur = 6;
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    };

    Particle.prototype.update = function () {
      this.x += this.speedX;
      this.y += this.speedY;

      if (this.x < 0 || this.x > width) this.speedX *= -1;
      if (this.y < 0 || this.y > height) this.speedY *= -1;
    };

    particles.current = [];
    for (let i = 0; i < 120; i++) {
      particles.current.push(new Particle());
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);
      particles.current.forEach((p) => {
        p.update();
        p.draw();
      });
      requestAnimationFrame(animate);
    }
    animate();

    function onResize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        background: "linear-gradient(135deg, #1e40af, #3b82f6)",
      }}
      aria-hidden="true"
    />
  );
}
