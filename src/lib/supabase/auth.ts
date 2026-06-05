"use client";

import { AuthUser } from "@/lib/auth-demo-data";
import { profileToAuthUser } from "@/lib/auth/profile";
import { createSupabaseBrowserClient } from "./client";

export async function signInWithPassword(email: string, password: string): Promise<AuthUser> {
  const supabase = createSupabaseBrowserClient();
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error("ログインユーザーを取得できませんでした。");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authData.user.id)
    .single();

  if (profileError) throw profileError;
  return profileToAuthUser(profile);
}

export async function signOutSupabase() {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.signOut();
}
