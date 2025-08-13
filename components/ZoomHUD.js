export default function ZoomHUD({ zoom, onZoomIn, onZoomOut }) {
  return (
    <div className="fixed left-4 bottom-6 bg-neutral-900/90 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
      <button className="btn-ghost" onClick={onZoomOut}>−</button>
      <div className="w-16 text-center">{Math.round(zoom*100)}%</div>
      <button className="btn-ghost" onClick={onZoomIn}>＋</button>
    </div>
  );
}
