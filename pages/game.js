import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import NavBar from "../components/NavBar";
import Sidebar from "../components/Sidebar";
import ZoomHUD from "../components/ZoomHUD";
import { useSession } from "next-auth/react";

const CanvasGrid = dynamic(() => import("../components/CanvasGrid.client"), { ssr: false });

const GRID = 1000;
const TOTAL = GRID * GRID;

function priceCentsFromBuyCount(before) {
  // first buy -> before=0 -> 1 cent
  return Math.pow(2, Math.max(0, before)) * 1;
}

export default function Game() {
  const { data: session } = useSession();

  // dataMap: { index: [color, intensity, buyCount] }
  const [dataMap, setDataMap] = useState({});
  const [range, setRange] = useState([0, 10000]); // fenêtre chargée
  const [loading, setLoading] = useState(false);

  const [zoom, setZoom] = useState(2.3);
  const [selected, setSelected] = useState(null);
  const [color, setColor] = useState("#ff0000");
  const [intensity, setIntensity] = useState(30);

  const [balanceCents, setBalanceCents] = useState(0);

  // Charger fenêtre
  async function loadWindow(s = range[0], e = range[1]) {
    setLoading(true);
    const res = await fetch(`/api/pixels/get?start=${s}&end=${e}`);
    const json = await res.json();
    setDataMap(json);
    setLoading(false);
  }

  // Charger balance
  async function loadMe() {
    if (!session?.user?.id) return setBalanceCents(0);
    const res = await fetch("/api/me");
    if (!res.ok) return;
    const me = await res.json();
    setBalanceCents(me.balanceCents);
  }

  useEffect(() => { loadWindow(); }, []);
  useEffect(() => { loadMe(); }, [session]);

  // simple API /api/me
  // (créons la route ci-dessous)
  // prix courant du pixel sélectionné
  const currentPriceCents = useMemo(() => {
    if (selected == null) return 1;
    const info = dataMap[selected];
    const buyCount = info ? info[2] : 0;
    return priceCentsFromBuyCount(buyCount);
  }, [selected, dataMap]);

  const nextPriceCents = currentPriceCents * 2;
  const prevPurchases = useMemo(() => (selected != null && dataMap[selected] ? dataMap[selected][2] : 0), [selected, dataMap]);

  function onWheelZoom(e) {
    e.preventDefault();
    const dir = e.deltaY > 0 ? -1 : 1;
    setZoom(z => {
      let nz = z + dir * 0.2;
      if (nz < 0.5) nz = 0.5;
      if (nz > 25) nz = 25;
      return nz;
    });
  }

  async function onPurchase() {
    if (!session) return alert("Please sign in.");
    if (selected == null) return alert("Select a pixel first.");
    const res = await fetch("/api/pixels/buy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pixelIndex: selected, color, intensity })
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error || "Error");
      return;
    }
    // update local map
    setDataMap(prev => ({
      ...prev,
      [selected]: [color, intensity, (prev[selected]?.[2] ?? 0) + 1]
    }));
    setBalanceCents(c => c - json.priceCents);
  }

  async function onAddFunds() {
    const amount = prompt("Amount to add (€):", "10");
    if (!amount) return;
    const cents = Math.round(parseFloat(amount) * 100);
    const res = await fetch("/api/wallet/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountCents: cents })
    });
    const json = await res.json();
    if (!res.ok) { alert(json.error || "Error"); return; }
    window.location.href = json.url;
  }

  function zoomIn(){ setZoom(z => Math.min(25, z + 0.2)); }
  function zoomOut(){ setZoom(z => Math.max(0.5, z - 0.2)); }

  return (
    <div className="flex flex-col min-h-screen">
      <NavBar balanceCents={balanceCents} onAddFunds={onAddFunds} />

      <div className="flex flex-1">
        {/* Zone Canvas */}
        <div className="flex-1 relative">
          <CanvasGrid
            dataMap={dataMap}
            zoom={zoom}
            onWheelZoom={onWheelZoom}
            onSelect={setSelected}
          />
          <div className="absolute left-0 right-[360px] top-0 pointer-events-none">
            {/* barre fine style capture */}
            <div className="h-1 border-t border-indigo-900/70" />
          </div>
          <ZoomHUD zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} />
          <div className="absolute left-6 bottom-4 text-neutral-400 text-sm">🖱️ Click pixel to select</div>
        </div>

        {/* Panneau latéral */}
        <Sidebar
          currentPriceCents={currentPriceCents}
          prevPurchases={prevPurchases}
          color={color} setColor={setColor}
          intensity={intensity} setIntensity={setIntensity}
          onPurchase={onPurchase}
          nextPriceCents={nextPriceCents}
        />
      </div>
    </div>
  );
}
