import { createClient } from "@supabase/supabase-js";

/* Browser client for /admin. Unlike the public site's anon client it keeps the signed-in admin's session,
   so every query runs as that user and the database's row-level security applies. Default schema: website. */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

export const sb = createClient(url, key, {
  db: { schema: "website" },
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "qcu-admin-auth", flowType: "pkce" },
});

/** Calls an /api/admin/* route with the current access token. */
export async function adminFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await sb.auth.getSession();
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error || "Something went wrong.");
  return body as T;
}
