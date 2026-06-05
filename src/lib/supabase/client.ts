"use client";

import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/types/database";
import { getSupabaseBrowserEnv, hasSupabaseBrowserEnv } from "./env";

export function createSupabaseBrowserClient() {
  const { url, anonKey } = getSupabaseBrowserEnv();
  return createBrowserClient<Database>(url, anonKey);
}

export function canUseSupabaseBrowserClient() {
  return hasSupabaseBrowserEnv();
}
