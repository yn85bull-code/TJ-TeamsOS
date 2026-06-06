# Supabase 接続手順

## 1. プロジェクト作成

Supabase Dashboard で新しいProjectを作成します。

作成後、Project Settings > Data API から次の2つを確認します。

- Project URL
- publishable key

この2つをアプリ直下の `.env.local` に入れます。

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Owner専用のユーザー招待で使用します。ブラウザには出さないでください。
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
```

## 2. DBスキーマ作成

Dashboard > SQL Editor で、次のSQLを全て実行します。

```text
supabase/migrations/20260603_initial_schema.sql
```

## 3. Authユーザー作成

Dashboard > Authentication > Users からユーザーを作成します。

テスト用の推奨ユーザー:

- yamada@example.com / Owner
- suzuki@example.com / Admin
- sato@example.com / Manager
- tanaka@example.com / Member

## 4. profiles登録

Authユーザー作成後、各ユーザーの UUID を確認し、次のテンプレート内のUUIDを差し替えてSQL Editorで実行します。

```text
supabase/seed_profiles_template.sql
```

この環境で作成済みの4ユーザーへそのまま反映する場合は、次のSQLを実行します。

```text
supabase/align_profile_roles_20260606.sql
```

このSQLは、Ownerを山田太郎さんに固定し、Admin/Manager/Memberへ旧ロールを整理します。

## 5. ローカル確認

環境変数を入れた後、サーバーを再起動します。

```powershell
npm run start -- --hostname 0.0.0.0 --port 3000
```

ログイン画面の「本ログイン」が有効になれば接続準備OKです。

## 6. TeamOS内からユーザー招待

`SUPABASE_SERVICE_ROLE_KEY` を `.env.local` に設定し、開発サーバーを再起動します。

Ownerで本ログインしたあと、TeamOSの `Settings > ユーザー設定 > ユーザー招待` から招待メールを送れます。

- Ownerは山田太郎さん固定
- 招待時に選べる権限は Admin / Manager / Member
- 招待後、`public.profiles` に氏名・メール・部門・権限が登録されます
- デモログインでは送信せず、フォーム確認のみできます
