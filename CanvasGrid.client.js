import { useEffect, useRef } from "react";
const GRID = 1000;
const PIXEL_SIZE = 1; // base 1 px, on scale with zoom in parent

export default function CanvasGrid({ dataMap, zoom, onWheelZoom, onSelect }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = GRID * PIXEL_SIZE;
    const h = GRID * PIXEL_SIZE;
    canvas.width = w;
    canvas.height = h;

    // clear
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    // draw bought pixels subset from dataMap: {index:[color,intensity,buyCount]}
    for (const [k, v] of Object.entries(dataMap)) {
      const idx = Number(k);
      const [hex, intensity] = v;
      const x = idx % GRID, y = (idx - x) / GRID;

      // apply intensity -> lighter
      const col = applyIntensity(hex, intensity);
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  }, [dataMap]);

  function applyIntensity(hex, intensity) {
    let r = parseInt(hex.slice(1,3),16);
    let g = parseInt(hex.slice(3,5),16);
    let b = parseInt(hex.slice(5,7),16);
    const f = intensity / 30;
    r = Math.min(255, Math.floor(r + (255 - r)*f));
    g = Math.min(255, Math.floor(g + (255 - g)*f));
    b = Math.min(255, Math.floor(b + (255 - b)*f));
    return `rgb(${r},${g},${b})`;
  }

  function onClick(e) {
    const rect = ref.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / zoom);
    const y = Math.floor((e.clientY - rect.top) / zoom);
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return;
    const idx = y * GRID + x;
    onSelect?.(idx);
  }

  return (
    <div
      className="flex items-center justify-center overflow-auto bg-black"
      onWheel={onWheelZoom}
    >
      <canvas
        ref={ref}
        onClick={onClick}
        style={{
          width: `${GRID * zoom}px`,
          height: `${GRID * zoom}px`,
          imageRendering: "pixelated",
          border: "1px solid rgba(255,255,255,0.05)"
        }}
      />
    </div>
  );
}
