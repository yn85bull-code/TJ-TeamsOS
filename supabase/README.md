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

MyToDo・メモの `my_todos` テーブルを追加します。

```text
supabase/add_my_todos_20260606.sql
```

MyToDoは通常タスクや承認フローとは別物です。RLSは `auth.uid() = user_id` に固定しているため、Owner / Admin / Managerでも他ユーザーのMyToDoは取得・更新できません。

## 6. Organization / TeamToDo

Organization用のprofiles追加カラム、Leader権限、TeamToDoの `teams_todos` テーブルを追加します。

```text
supabase/add_teams_todos_and_organization_20260606.sql
supabase/add_teams_todo_assignments_20260606.sql
```

- TeamToDoはProject / Task / Approvalsとは別物です
- 取得範囲はログインユーザーの `organization` / `department` に限定します
- 登録・編集・削除はOwner / Admin / Manager / Leaderに限定します
- MemberはTeamToDoの閲覧のみです
- 登録・編集時に所属内ユーザーを指名すると、指名先のMyToDoへ個別登録します
- 指名先MyToDoは本人の `user_id` に紐づくため、Owner/Admin/Managerでも通常画面では中身を閲覧できません
- 停止中/退職ユーザーはアプリ側ログイン時にもブロックします

## 7. プロフィール画像

プロフィール画像をファイルアップロードで保存するStorage Bucketを追加します。

```text
supabase/add_profile_avatar_storage_20260606.sql
```

- 画面ではURL入力ではなく画像ファイルを選択します
- ファイルはSupabase Storageの `profile-avatars` bucketに保存します
- `public.profiles.avatar_url` には表示用URLのみ保存します
- 対応形式は JPG / PNG / WEBP / GIF、上限は5MBです

## 8. ローカル確認

開発サーバー:

```powershell
npm run dev
```

共有サーバー:

```powershell
npm run start -- --hostname 0.0.0.0 --port 3000
```

## 9. TeamOS内からユーザー招待

`.env.local` に `SUPABASE_SERVICE_ROLE_KEY` を設定して開発サーバーを再起動します。

Owner/Adminで本ログインしたあと、`Settings > ユーザー設定 > ユーザー招待` から招待メールを送れます。

- Ownerは楢原悠太郎さんのみ
- 招待時に選べる権限はAdmin / Manager / Leader / Member
- 招待後、`public.profiles` に氏名、メール、所属、役職、権限、在籍状態が登録されます
- デモログインでは送信せず、フォーム確認のみできます
