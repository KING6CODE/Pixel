import { useState } from "react";
import { useRouter } from "next/router";
import { apiPost } from "@/lib/api";

export default function SignUp() {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [name,setName]=useState("");
  const router = useRouter();

  async function submit() {
    try {
      // Create account
      await apiPost("/auth/register", { email, password, name });
      // Then login to get token
      const { token } = await apiPost("/auth/login", { email, password });
      localStorage.setItem("pixel_auth_token", token);
      router.push("/game");
    } catch (e) {
      alert(e.message || "Error");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="card w-full max-w-md space-y-4">
        <h2 className="text-2xl font-bold">Create account</h2>
        <input className="input" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} />
        <input className="input" placeholder="email@example.com" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="input" type="password" placeholder="Mi...s" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="btn-primary w-full" onClick={submit}>Create</button>
      </div>
    </div>
  );
}
