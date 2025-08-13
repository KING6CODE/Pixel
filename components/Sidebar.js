export default function Sidebar({
  currentPriceCents,
  prevPurchases,
  color, setColor,
  intensity, setIntensity,
  onPurchase,
  nextPriceCents
}) {
  const palette = ["#ff0000","#00ff00","#0066ff","#00ffff","#ffff00","#ff00ff","#ffffff","#00ff88","#000000"];
  return (
    <aside className="w-[360px] p-4 space-y-4">
      <div className="card">
        <div className="text-sm text-neutral-400">Current Price</div>
        <div className="text-3xl font-extrabold">€{(currentPriceCents/100).toFixed(2)}</div>
        <div className="text-xs text-neutral-400">{prevPurchases} previous purchases</div>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center gap-2 text-neutral-300"><span>🎨</span><span>Pixel Color</span></div>
        <input type="color" value={color} onChange={e=>setColor(e.target.value)} className="w-full h-10 rounded-md overflow-hidden" />
        <div className="flex gap-2">
          {palette.map(c=>(
            <button key={c} onClick={()=>setColor(c)} className="w-7 h-7 rounded-md border border-white/10" style={{background:c}} />
          ))}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 text-neutral-300"><span>🔆</span><span>Intensity Level</span></div>
        <input type="range" min={0} max={30} value={intensity} onChange={e=>setIntensity(Number(e.target.value))} className="w-full" />
        <div className="text-center text-sm text-neutral-400">{intensity}/30</div>
      </div>

      <button onClick={onPurchase} className="btn-primary w-full text-lg">
        🛒 Purchase Pixel for €{(currentPriceCents/100).toFixed(2)}
      </button>

      <div className="card">
        <ul className="list-disc list-inside text-sm text-neutral-300 space-y-1">
          <li>Each pixel starts at €0.01 and doubles with every purchase.</li>
          <li>Next price: €{(nextPriceCents/100).toFixed(2)}</li>
        </ul>
      </div>

      <div className="card space-y-2">
        <div className="font-semibold">📊 Grid Statistics</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-neutral-800 rounded-lg p-3">
            <div className="text-xs text-neutral-400">Pixels Owned</div>
            <div className="text-2xl font-extrabold">1</div>
          </div>
          <div className="bg-neutral-800 rounded-lg p-3">
            <div className="text-xs text-neutral-400">Total Value</div>
            <div className="text-2xl font-extrabold">€0.01</div>
          </div>
        </div>
        <div className="text-sm text-neutral-400 pt-2">
          Available Pixels: 999999<br/>Completion: 0.0001%
        </div>
      </div>
    </aside>
  );
}
