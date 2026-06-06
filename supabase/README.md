# Supabase 接続手順

## 1. 環境変数

Supabase Dashboardの `Project Settings > Data API` で次を確認し、アプリ直下の `.env.local` に設定します。

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Owner専用のユーザー招待APIで使用します。ブラウザには出さないでください。
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
```

## 2. 初期スキーマ

SQL Editorで次を実行します。

```text
supabase/migrations/20260603_initial_schema.sql
```

## 3. プロフィールと権限

Authユーザー作成後、`public.profiles` にユーザー情報を登録します。

```text
supabase/seed_profiles_template.sql
```

既存ユーザーのOwner/Admin/Manager/Memberを揃える場合:

```text
supabase/align_profile_roles_20260606.sql
```

課題、タスク、承認フローのRLS・権限制御を反映する場合:

```text
supabase/apply_permission_model_20260606.sql
```

## 4. TaurosAI

TaurosAIのナレッジ、ファイル、チャットログ、FAQ候補、Storage Bucketを追加します。

```text
supabase/add_tauros_ai_knowledge_20260606.sql
```

## 5. MyToDo

個人用ToDo・メモの `my_todos` テーブルを追加します。

```text
supabase/add_my_todos_20260606.sql
```

MyToDoは通常タスクや承認フローとは別物です。RLSは `auth.uid() = user_id` に固定しているため、Owner / Admin / Managerでも他ユーザーのMyToDoは取得・更新できません。

## 6. ローカル確認

開発サーバー:

```powershell
npm run dev
```

共有サーバー:

```powershell
npm run start -- --hostname 0.0.0.0 --port 3000
```

## 7. TeamOS内からユーザー招待

`.env.local` に `SUPABASE_SERVICE_ROLE_KEY` を設定して開発サーバーを再起動します。

Ownerで本ログインしたあと、`Settings > ユーザー設定 > ユーザー招待` から招待メールを送れます。

- Ownerは楢原悠太郎さんのみ
- 招待時に選べる権限はAdmin / Manager / Member
- 招待後、`public.profiles` に氏名、メール、部門、役職、権限が登録されます
- デモログインでは送信せず、フォーム確認のみできます
