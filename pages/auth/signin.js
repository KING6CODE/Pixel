import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";

export default function SignIn() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="card w-full max-w-md space-y-4">
        <h2 className="text-2xl font-bold">Sign in</h2>
        <input className="input" placeholder="email@example.com" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="input" type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="btn-primary w-full" onClick={()=>signIn("credentials",{ email, password, callbackUrl:"/game" })}>Continue</button>
        <p className="text-sm text-neutral-400">No account? <Link href="/auth/signup" className="text-brand-500">Create one</Link></p>
      </div>
    </div>
  );
}
