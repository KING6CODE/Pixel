import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-neutral-950 to-neutral-900">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-extrabold tracking-tight">
          <span className="text-white">Pixel</span><span className="text-brand-500">Grid</span>
        </h1>
        <p className="text-neutral-400">Buy, color and collect pixels. 1,000,000 grid. Price doubles each purchase.</p>
        <div className="flex gap-3 justify-center">
          <Link href="/auth/signin" className="btn-ghost">Sign in</Link>
          <Link href="/game" className="btn-primary">Enter Grid</Link>
        </div>
      </div>
    </main>
  );
}
