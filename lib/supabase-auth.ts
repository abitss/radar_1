import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

function client() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function throwIfError(error: { message?: string } | null) {
  if (error) throw new Error(error.message || "Authentication failed");
}

export async function signUpFounder(email: string, password: string, redirectTo: string) {
  const supabase = client();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirectTo },
  });
  throwIfError(error);
  return data;
}

export async function signInFounder(email: string, password: string) {
  const supabase = client();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  throwIfError(error);
  return data;
}

export async function sendPasswordRecovery(email: string, redirectTo: string) {
  const supabase = client();
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  throwIfError(error);
  return data;
}

export async function updateFounderPassword(accessToken: string, password: string) {
  const supabase = client();
  const { error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: accessToken,
  });
  throwIfError(sessionError);
  const { data, error } = await supabase.auth.updateUser({ password });
  throwIfError(error);
  return data;
}

export async function sendMagicLinkFounder(email: string, redirectTo: string) {
  const supabase = client();
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
  });
  throwIfError(error);
  return data;
}

export async function getFounderFromAccessToken(accessToken: string) {
  const supabase = client();
  const { data, error } = await supabase.auth.getUser(accessToken);
  throwIfError(error);
  return data.user;
}
