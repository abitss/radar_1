const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const RADAR_API_SECRET = process.env.RADAR_API_SECRET!;

function headers(extra: Record<string,string> = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    "x-radar-api-key": RADAR_API_SECRET,
    ...extra,
  };
}

export async function sbSelect(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function sbInsert(table: string, body: unknown) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function sbUpdate(table: string, query: string, body: unknown) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function sbDelete(table: string, query: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "DELETE",
    headers: headers({ Prefer: "return=representation" }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Conflict handling is enforced by the existing database unique indexes.
// Omitting founder-owned columns preserves them when discovered facts are merged.
export async function sbUpsert(table:string, body:unknown, onConflict:string, ignore=false) {
  const res=await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`,{
    method:"POST",headers:headers({Prefer:`resolution=${ignore?"ignore":"merge"}-duplicates,return=representation`}),
    body:JSON.stringify(body),cache:"no-store"
  });
  if(!res.ok)throw new Error(await res.text());
  return res.json();
}
