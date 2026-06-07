import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { AppRole, Database } from "@/types/database";

export const runtime = "nodejs";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type SelectByIdTable<T> = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      single: () => Promise<{ data: T | null; error: Error | null }>;
    };
  };
};

type UserAuthAction = "resend_invite" | "send_password_reset";

const allowedInviteRoles: AppRole[] = ["admin", "department_manager", "leader", "member"];

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const profileId = normalizeText(payload.profileId);
    const action = normalizeAction(payload.action);

    if (!profileId || !action) {
      return NextResponse.json({ error: "対象ユーザーと操作を確認してください。" }, { status: 400 });
    }

    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
    if (!accessToken) {
      return NextResponse.json({ error: "本ログイン後に実行してください。" }, { status: 401 });
    }

    const { url, publishableKey, serviceRoleKey } = getSupabaseServerEnv();
    const serviceClient = createClient<Database>(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const authClient = createClient<Database>(url, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: requesterData, error: requesterError } = await authClient.auth.getUser(accessToken);
    if (requesterError || !requesterData.user) {
      return NextResponse.json({ error: "ログインユーザーを確認できません。" }, { status: 401 });
    }

    const profilesSelect = serviceClient.from("profiles") as unknown as SelectByIdTable<ProfileRow>;
    const { data: requesterProfile, error: requesterProfileError } = await profilesSelect
      .select("id, role")
      .eq("id", requesterData.user.id)
      .single();

    if (requesterProfileError || !["owner", "admin"].includes(requesterProfile?.role ?? "")) {
      return NextResponse.json({ error: "ユーザー認証操作はOwner/Adminのみ実行できます。" }, { status: 403 });
    }

    const { data: targetProfile, error: targetProfileError } = await profilesSelect
      .select("*")
      .eq("id", profileId)
      .single();

    if (targetProfileError || !targetProfile) {
      return NextResponse.json({ error: "対象ユーザーが見つかりません。" }, { status: 404 });
    }

    const email = normalizeEmail(targetProfile.email);
    if (!email) {
      return NextResponse.json({ error: "対象ユーザーのメールアドレスが未設定です。" }, { status: 400 });
    }

    if (action === "send_password_reset") {
      const { error } = await serviceClient.auth.resetPasswordForEmail(email, {
        redirectTo: getAuthRedirectUrl("recovery"),
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({
        message: `${targetProfile.display_name}さんへパスワード再設定メールを送信しました。`,
      });
    }

    if (targetProfile.role === "owner") {
      return NextResponse.json({ error: "Ownerには招待再送できません。必要な場合はパスワード再設定を送ってください。" }, { status: 400 });
    }

    const role = normalizeInviteRole(targetProfile.role) ?? "member";
    const { error } = await serviceClient.auth.admin.inviteUserByEmail(email, {
      data: {
        display_name: targetProfile.display_name,
        department_name: targetProfile.department ?? targetProfile.organization ?? "",
        position: targetProfile.position ?? "",
        role,
      },
      redirectTo: getAuthRedirectUrl("invite"),
    });

    if (error) {
      return NextResponse.json({
        error: error.message.includes("already")
          ? "すでに本登録済みの可能性があります。パスワード再設定メールを送ってください。"
          : error.message,
      }, { status: 400 });
    }

    return NextResponse.json({
      message: `${targetProfile.display_name}さんへ招待メールを再送しました。`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "認証メール操作でエラーが発生しました。";
    return NextResponse.json({ error: message }, { status: message.includes("service_role") ? 500 : 400 });
  }
}

function normalizeAction(action: unknown): UserAuthAction | undefined {
  return action === "resend_invite" || action === "send_password_reset" ? action : undefined;
}

function normalizeInviteRole(role: unknown): AppRole | undefined {
  if (typeof role !== "string") return undefined;
  return allowedInviteRoles.includes(role as AppRole) ? role as AppRole : undefined;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function getSupabaseServerEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !publishableKey || !serviceRoleKey) {
    throw new Error("Supabase service_role設定が未完了です。NEXT_PUBLIC_SUPABASE_URL、publishable key、SUPABASE_SERVICE_ROLE_KEYを確認してください。");
  }

  return { url, publishableKey, serviceRoleKey };
}

function getAuthRedirectUrl(authType: "invite" | "recovery") {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return undefined;

  const url = new URL(appUrl);
  url.searchParams.set("auth", authType);
  return url.toString();
}
