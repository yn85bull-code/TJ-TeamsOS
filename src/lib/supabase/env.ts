export function hasSupabaseBrowserEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && getSupabaseBrowserKey());
}

export function getSupabaseBrowserEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = getSupabaseBrowserKey();

  if (!url || !anonKey) {
    throw new Error("Supabase browser environment variables are not configured.");
  }

  return { url, anonKey };
}

function getSupabaseBrowserKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}
