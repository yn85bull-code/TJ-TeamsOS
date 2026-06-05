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
- sato@example.com / Department Manager
- suzuki@example.com / Member
- tanaka@example.com / Viewer

## 4. profiles登録

Authユーザー作成後、各ユーザーの UUID を確認し、次のテンプレート内のUUIDを差し替えてSQL Editorで実行します。

```text
supabase/seed_profiles_template.sql
```

## 5. ローカル確認

環境変数を入れた後、サーバーを再起動します。

```powershell
npm run start -- --hostname 0.0.0.0 --port 3000
```

ログイン画面の「本ログイン」が有効になれば接続準備OKです。
