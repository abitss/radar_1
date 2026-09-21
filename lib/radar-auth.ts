import { createHmac, timingSafeEqual } from "node:crypto";

export type RadarUser = { id: string; email: string };

const COOKIE = "radar_session";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

function secret() {
  const value = process.env.RADAR_API_SECRET;
  if (!value) throw new Error("RADAR_API_SECRET is not configured");
  return value;
}

function b64(input: string) {
  return Buffer.from(input).toString("base64url");
}

function unb64(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function makeSession(user: RadarUser) {
  const payload = b64(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + THIRTY_DAYS }));
  return `${payload}.${sign(payload)}`;
}

export function readSession(req: Request): RadarUser | null {
  const cookie = req.headers.get("cookie") || "";
  const raw = cookie.split(";").map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!raw) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(unb64(payload));
    if (!parsed?.id || !parsed?.email || !parsed?.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return { id: String(parsed.id), email: String(parsed.email) };
  } catch {
    return null;
  }
}

export function sessionCookie(value: string) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${THIRTY_DAYS}`;
}

export function clearSessionCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function requireRadarUser(req: Request) {
  const user = readSession(req);
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}
