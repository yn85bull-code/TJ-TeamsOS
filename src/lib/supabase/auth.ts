"use client";

import { AuthUser } from "@/lib/auth-demo-data";
import { profileToAuthUser } from "@/lib/auth/profile";
import { Database } from "@/types/database";
import { createSupabaseBrowserClient } from "./client";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type DepartmentRow = Database["public"]["Tables"]["departments"]["Row"];

type SupabaseRedirectSessionResult = {
  user: AuthUser | null;
  isInvite: boolean;
  isRedirect: boolean;
};

export async function signInWithPassword(email: string, password: string): Promise<AuthUser> {
  const supabase = createSupabaseBrowserClient();
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error("ログインユーザーを取得できませんでした。");

  return loadAuthUserProfile(authData.user.id);
}

export async function consumeSupabaseRedirectSession(): Promise<SupabaseRedirectSessionResult> {
  const supabase = createSupabaseBrowserClient();
  const redirectState = readSupabaseRedirectState();

  if (redirectState.error) {
    cleanAuthRedirectUrl();
    throw new Error(getReadableRedirectError(redirectState.errorDescription || redirectState.error));
  }

  if (redirectState.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(redirectState.code);
    if (error) throw error;
    cleanAuthRedirectUrl();
  } else if (redirectState.accessToken && redirectState.refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: redirectState.accessToken,
      refresh_token: redirectState.refreshToken,
    });
    if (error) throw error;
    cleanAuthRedirectUrl();
  }

  if (!redirectState.isRedirect) {
    return { user: null, isInvite: false, isRedirect: false };
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.user) {
    return { user: null, isInvite: redirectState.isInvite, isRedirect: true };
  }

  return {
    user: await loadAuthUserProfile(data.session.user.id),
    isInvite: redirectState.isInvite,
    isRedirect: true,
  };
}

export async function updateCurrentSupabasePassword(password: string) {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

async function loadAuthUserProfile(userId: string): Promise<AuthUser> {
  const supabase = createSupabaseBrowserClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (profileError) throw profileError;
  const profileRow = profile as ProfileRow;
  if (!profileRow.is_active || profileRow.employment_status === "停止中" || profileRow.employment_status === "退職") {
    await supabase.auth.signOut();
    throw new Error("このアカウントは停止中です。Owner/Adminへ確認してください。");
  }
  const authUser = profileToAuthUser(profileRow);

  if (!profileRow.department_id) {
    return authUser;
  }

  const { data: department } = await supabase
    .from("departments")
    .select("name")
    .eq("id", profileRow.department_id)
    .maybeSingle();
  const departmentRow = department as Pick<DepartmentRow, "name"> | null;

  return {
    ...authUser,
    department: departmentRow?.name ?? authUser.department,
  };
}

export async function signOutSupabase() {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.signOut();
}

function readSupabaseRedirectState() {
  if (typeof window === "undefined") {
    return {
      accessToken: null,
      refreshToken: null,
      code: null,
      error: null,
      errorDescription: null,
      isInvite: false,
      isRedirect: false,
    };
  }

  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  const queryParams = url.searchParams;
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");
  const code = queryParams.get("code");
  const type = hashParams.get("type") ?? queryParams.get("type") ?? queryParams.get("auth");
  const error = hashParams.get("error") ?? queryParams.get("error");
  const errorDescription = hashParams.get("error_description") ?? queryParams.get("error_description");
  const isRedirect = Boolean(accessToken || refreshToken || code || error || queryParams.get("auth") === "invite");
  const isInvite = type === "invite" || (isRedirect && Boolean(accessToken || code) && !type);

  return {
    accessToken,
    refreshToken,
    code,
    error,
    errorDescription,
    isInvite,
    isRedirect,
  };
}

function cleanAuthRedirectUrl() {
  if (typeof window === "undefined") return;
  window.history.replaceState({}, document.title, window.location.pathname);
}

function getReadableRedirectError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("expired") || normalized.includes("invalid")) {
    return "招待リンクの有効期限が切れています。すでに承認済みの場合は、本ログインからメールアドレスとパスワードでログインしてください。";
  }

  return message;
}
