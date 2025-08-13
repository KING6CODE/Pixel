import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { apiPost } from "@/lib/api";

export default function SignIn() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const router = useRouter();

  async function submit() {
    try {
      const { token } = await apiPost("/auth/login", { email, password });
      localStorage.setItem("pixel_auth_token", token);
      router.push("/game");
    } catch (e) {
      alert(e.message || "Login failed");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="card w-full max-w-md space-y-4">
        <h2 className="text-2xl font-bold">Sign in</h2>
        <input className="input" placeholder="email@example.com" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="input" type="password" placeholder="••...•" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="btn-primary w-full" onClick={submit}>Continue</button>
        <p className="text-sm text-neutral-400">No account? <Link href="/auth/signup" className="text-brand-500">Create one</Link></p>
      </div>
    </div>
  );
}
