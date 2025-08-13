import { useState } from "react";
import { signIn } from "next-auth/react";

export default function SignUp() {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [name,setName]=useState("");

  async function submit() {
    const res = await fetch("/api/auth/register", {
      method:"POST", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ email, password, name })
    });
    if (res.ok) {
      await signIn("credentials", { email, password, callbackUrl: "/game" });
    } else {
      alert((await res.json()).error || "Error");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="card w-full max-w-md space-y-4">
        <h2 className="text-2xl font-bold">Create account</h2>
        <input className="input" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} />
        <input className="input" placeholder="email@example.com" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="input" type="password" placeholder="Min 6 chars" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="btn-primary w-full" onClick={submit}>Create</button>
      </div>
    </div>
  );
}
