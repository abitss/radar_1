const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

async function authRequest(path: string, body: unknown) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  let data: any;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
  if (!res.ok) throw new Error(data?.msg || data?.message || data?.error_description || "Authentication failed");
  return data;
}

export async function signUpFounder(email: string, password: string, redirectTo: string) {
  return authRequest(`signup?redirect_to=${encodeURIComponent(redirectTo)}`, { email, password });
}

export async function signInFounder(email: string, password: string) {
  return authRequest("token?grant_type=password", { email, password });
}
