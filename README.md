# TJ-TeamOS

Tauros向けのWork OS / MVPです。課題、Project、承認、権限管理、TaurosAI、MyToDo/TeamsToDoをローカルデモからSupabase接続まで検証できます。

## ローカル起動

```powershell
npm run dev
```

ローカル確認:

```text
http://localhost:3000/
```

LAN共有確認:

```text
http://192.168.0.128:3000/
```

## 主な画面

- `Dashboard`: 期限、承認、担当Project、MyToDo/TeamsToDoを確認
- `Issues`: 課題登録、タスク化、論理削除
- `Project`: 通常タスク、チームタスク、承認待ち、差し戻しタスク
- `MyToDo`: 個人用ToDo・メモ、所属内TeamsToDo。どちらも承認フロー対象外
- `Approvals`: Manager確認、Owner/Admin最終承認、差し戻し
- `Organization`: 所属、役職、権限、在籍状態の確認
- `TaurosAI`: 社内ナレッジ、業務ルール、マニュアル、FAQのAI確認
- `Settings`: Owner/Adminのユーザー招待、権限・部門・役職・停止状態管理

## MyToDo

MyToDoは、課題化・通常タスク化するほどではない個人用ToDoとメモです。

- URL: `http://localhost:3000/my-todo`
- 全権限で利用可能
- Owner / Admin / Manager / Memberの全員が、自分のMyToDoのみ閲覧・編集可能
- Issues / Project / Approvals / Manager確認 / Owner承認とは連動しない
- Dashboardには未完了、期限が近い、高優先度のMyToDoだけを確認用に表示
- 新規登録、編集、削除、完了チェック、ステータス変更、期限、優先度管理はMyToDoページで実施

## TeamsToDo

TeamsToDoは、課題化やProject化する前の所属共有ToDoです。

- MyToDoページ内の `所属ToDo` タブで利用
- Owner / Admin / Manager / Leaderは所属内TeamsToDoを登録・編集・削除可能
- Memberは所属内TeamsToDoを閲覧のみ
- 登録・編集時に所属内メンバーを指名でき、指名された人のMyToDoへ個別登録される
- 通常画面ではOwner/Adminでも本人の所属TeamsToDoだけを表示
- 承認申請、Manager確認、Owner/Admin承認、差し戻しとは連動しない

Supabase SQL:

```text
supabase/add_my_todos_20260606.sql
supabase/add_teams_todos_and_organization_20260606.sql
supabase/add_teams_todo_assignments_20260606.sql
```

## TaurosAI

TaurosAIは、社内ナレッジ、業務ルール、マニュアル、FAQをAIに質問できる社内AIアシスタントです。

- URL: `http://localhost:3000/tauros-ai`
- 画面キー: `tauros_ai`
- ナレッジ管理はOwner / Adminのみ

設計メモ:

```text
docs/tauros-ai-knowledge-design.md
```

Supabase SQL:

```text
supabase/add_tauros_ai_knowledge_20260606.sql
```

## Supabase

Supabase接続とDB反映の手順は次を参照してください。

```text
supabase/README.md
```
