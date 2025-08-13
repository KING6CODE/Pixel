export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function apiGet(path, token) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
  return res.json();
}

export async function apiPost(path, body, token) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
