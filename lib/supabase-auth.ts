const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

async function parseAuthResponse(res: Response) {
  const text = await res.text();
  let data: any;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
  if (!res.ok) throw new Error(data?.msg || data?.message || data?.error_description || "Authentication failed");
  return data;
}

async function authRequest(path: string, body: unknown, method = "POST", accessToken?: string) {
  const headers: Record<string, string> = {
    apikey: SUPABASE_KEY,
    "Content-Type": "application/json",
  };

  // New Supabase publishable keys are opaque API keys, not user JWTs.
  // Only attach Authorization when we actually have an authenticated user token.
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(body),
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

export async function sendPasswordRecovery(email: string, redirectTo: string) {
  return authRequest(`recover?redirect_to=${encodeURIComponent(redirectTo)}`, { email });
}

export async function updateFounderPassword(accessToken: string, password: string) {
  return authRequest("user", { password }, "PUT", accessToken);
}

export async function sendMagicLinkFounder(email: string, redirectTo: string) {
  return authRequest(`otp?redirect_to=${encodeURIComponent(redirectTo)}`, {
    email,
    create_user: false,
  });
}

export async function getFounderFromAccessToken(accessToken: string) {
  return authRequest("user", {}, "GET", accessToken);
}
