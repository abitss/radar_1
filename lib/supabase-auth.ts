const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

async function parseAuthResponse(res: Response) {
  const text = await res.text();
  let data: any;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
  if (!res.ok) throw new Error(data?.msg || data?.message || data?.error_description || "Authentication failed");
  return data;
}

async function authRequest(path: string, body: unknown) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return parseAuthResponse(res);
}

export async function signUpFounder(email: string, password: string, redirectTo: string) {
  return authRequest(`signup?redirect_to=${encodeURIComponent(redirectTo)}`, { email, password });
}

export async function signInFounder(email: string, password: string) {
  return authRequest("token?grant_type=password", { email, password });
}

export async function sendMagicLinkFounder(email: string, redirectTo: string) {
  return authRequest(`otp?redirect_to=${encodeURIComponent(redirectTo)}`, {
    email,
    create_user: false,
  });
}

export async function getFounderFromAccessToken(accessToken: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "GET",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return parseAuthResponse(res);
}
