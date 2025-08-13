import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function NavBar({ balanceCents, onAddFunds }) {
  const { data: session } = useSession();
  return (
    <header className="w-full h-14 bg-neutral-900 border-b border-white/10 flex items-center px-4">
      <Link href="/game" className="flex items-center gap-2 font-extrabold">
        <span className="text-brand-500">▦</span><span>PixelGrid</span>
      </Link>

      <div className="ml-6 text-sm text-neutral-400">1,000,000 Pixels • {session ? "1 Owned" : "Guest"}</div>
      <div className="ml-auto flex items-center gap-3">
        <div className="text-sm text-neutral-300">Balance:&nbsp;
          <span className="font-bold">€{(balanceCents/100).toFixed(2)}</span>
        </div>
        <button className="btn-primary" onClick={onAddFunds}>Add Funds</button>
        {session ? (
          <button className="btn-ghost" onClick={()=>signOut({callbackUrl:"/"})}>Logout</button>
        ) : (
          <Link href="/auth/signin" className="btn-ghost">Sign in</Link>
        )}
      </div>
    </header>
  );
}
