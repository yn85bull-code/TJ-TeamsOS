import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { AppRole, Database } from "@/types/database";

export const runtime = "nodejs";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
type DepartmentRow = Database["public"]["Tables"]["departments"]["Row"];
type SelectByIdTable<T> = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      single: () => Promise<{ data: T | null; error: Error | null }>;
    };
  };
};
type ProfileUpdateTable = {
  update: (payload: ProfileUpdate) => {
    eq: (column: string, value: string) => {
      select: (columns: string) => {
        single: () => Promise<{ data: ProfileRow | null; error: Error | null }>;
      };
    };
  };
};

const AVATAR_BUCKET = "profile-avatars";
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
    if (!accessToken) {
      return NextResponse.json({ error: "ログイン情報を確認できません。本ログイン後に実行してください。" }, { status: 401 });
    }

    const formData = await request.formData();
    const profileId = normalizeText(formData.get("profileId"));
    const avatar = formData.get("avatar");

    if (!profileId) {
      return NextResponse.json({ error: "更新対象のユーザーを確認してください。" }, { status: 400 });
    }
    if (!(avatar instanceof File)) {
      return NextResponse.json({ error: "プロフィール画像ファイルを選択してください。" }, { status: 400 });
    }
    if (!ALLOWED_AVATAR_TYPES.includes(avatar.type)) {
      return NextResponse.json({ error: "プロフィール画像は JPG / PNG / WEBP / GIF を選択してください。" }, { status: 400 });
    }
    if (avatar.size > MAX_AVATAR_SIZE) {
      return NextResponse.json({ error: "プロフィール画像は5MB以下で選択してください。" }, { status: 400 });
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

    const requesterRole = requesterProfile?.role as AppRole | undefined;
    const canManageProfiles = requesterRole === "owner" || requesterRole === "admin";
    if (requesterProfileError || (!canManageProfiles && requesterData.user.id !== profileId)) {
      return NextResponse.json({ error: "プロフィール画像の変更は本人またはOwner/Adminのみ実行できます。" }, { status: 403 });
    }

    const { data: targetProfile, error: targetProfileError } = await profilesSelect
      .select("*")
      .eq("id", profileId)
      .single();

    if (targetProfileError || !targetProfile) {
      return NextResponse.json({ error: "更新対象のユーザーが見つかりません。" }, { status: 404 });
    }

    await ensureAvatarBucket(serviceClient);

    const extension = getAvatarExtension(avatar);
    const objectPath = `${profileId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const buffer = Buffer.from(await avatar.arrayBuffer());
    const uploadResult = await serviceClient.storage
      .from(AVATAR_BUCKET)
      .upload(objectPath, buffer, {
        contentType: avatar.type,
        upsert: true,
      });

    if (uploadResult.error) {
      return NextResponse.json({ error: "プロフィール画像のアップロードに失敗しました。" }, { status: 500 });
    }

    const publicUrlResult = serviceClient.storage.from(AVATAR_BUCKET).getPublicUrl(objectPath);
    const avatarUrl = publicUrlResult.data.publicUrl;

    const profilesTable = serviceClient.from("profiles") as unknown as ProfileUpdateTable;
    const { data: profile, error: updateError } = await profilesTable
      .update({ avatar_url: avatarUrl })
      .eq("id", profileId)
      .select("*")
      .single();

    if (updateError || !profile) {
      return NextResponse.json({ error: "プロフィール画像情報の保存に失敗しました。" }, { status: 500 });
    }

    let departmentName = profile.organization ?? profile.department ?? undefined;
    if (!departmentName && profile.department_id) {
      const departmentsSelect = serviceClient.from("departments") as unknown as SelectByIdTable<DepartmentRow>;
      const departmentResult = await departmentsSelect
        .select("id, name")
        .eq("id", profile.department_id)
        .single();
      departmentName = departmentResult.data?.name;
    }

    return NextResponse.json({
      profile: {
        id: profile.id,
        displayName: profile.display_name,
        email: profile.email,
        departmentId: profile.department_id,
        departmentName,
        organization: profile.organization ?? departmentName,
        position: profile.position,
        role: profile.role,
        isActive: profile.is_active,
        employmentStatus: profile.employment_status ?? (profile.is_active ? "在籍中" : "停止中"),
        joinedAt: profile.joined_at,
        avatarUrl: profile.avatar_url,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "プロフィール画像アップロードでエラーが発生しました。";
    return NextResponse.json({ error: message }, { status: message.includes("service_role") ? 500 : 400 });
  }
}

async function ensureAvatarBucket(serviceClient: ReturnType<typeof createClient<Database>>) {
  const bucket = await serviceClient.storage.getBucket(AVATAR_BUCKET);
  if (!bucket.error) return;

  const createResult = await serviceClient.storage.createBucket(AVATAR_BUCKET, {
    public: true,
    allowedMimeTypes: ALLOWED_AVATAR_TYPES,
    fileSizeLimit: MAX_AVATAR_SIZE,
  });

  if (createResult.error && !createResult.error.message.toLowerCase().includes("already")) {
    throw new Error("プロフィール画像用Storage bucketを作成できませんでした。");
  }
}

function getAvatarExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return "jpg";
}

function normalizeText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
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
