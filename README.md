# TJ-TeamOS

Tauros向けのWork OS / MVPです。Project、Task、承認、権限管理、TaurosAI、MyToDo/TeamToDoをローカルデモからSupabase接続まで検証できます。

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

- `HOME`: カレンダー、今日の予定、担当Task進捗、MyToDo/TeamToDoを確認
- `Project`: Project登録、Task化、論理削除
- `Task`: 通常タスク、チームタスク、承認待ち、差し戻しタスク
- `MyToDo`: MyToDo・メモ、TeamToDo。どちらも承認フロー対象外
- `Calendar`: ログインユーザー本人に関係するTask、MyToDo、TeamToDo、承認予定を月表示
- `Workflow`: 社内申請、Manager確認、Owner/Admin最終承認、差し戻し履歴
- `Approvals`: Manager確認、Owner/Admin最終承認、差し戻し
- `Organization`: 所属、役職、権限、在籍状態の確認
- `TaurosAI`: 社内ナレッジ、業務ルール、マニュアル、FAQのAI確認
- `Settings`: Owner/Adminのユーザー招待、権限・部門・役職・停止状態管理

## Calendar

Calendarは、本人に関係する業務予定だけを月表示で確認するMVPです。

- Task: 担当者、担当責任者、登録者、または権限上見える所属Taskだけ表示
- MyToDo: ログインユーザー本人のToDoだけ表示
- TeamToDo: 指名されたToDo、登録したToDo、または所属Managerが見えるToDoだけ表示
- Approvals: 申請者、確認者、最終承認者、所属Manager、Owner/Adminが見える承認だけ表示
- 日付セルにTask、ToDo、承認、差し戻し、期限超過の件数を表示
- 詳細カードからTask、MyToDo、Approvalsへ移動可能

Google Calendar連携は未実装です。まずTeamOS側を予定の正として、次段階で外部同期を追加します。

## Workflow

Workflowは、Task承認とは別系統の社内申請MVPです。

- 申請テンプレートを選んで申請を作成
- Manager確認、Owner/Admin最終承認、差し戻し、取消、再申請を履歴付きで管理
- Owner/Adminはテンプレートを追加、編集、削除可能
- CSV出力対応
- 現状の画面データはMVPとしてブラウザ保存です。本番DB運用時は下記SQLをSupabaseへ反映します。

Supabase SQL:

```text
supabase/add_workflow_mvp_20260607.sql
```

## MyToDo

MyToDoは、Project化・通常Task化するほどではない自分用のToDoとメモです。

- URL: `http://localhost:3000/my-todo`
- 全権限で利用可能
- Owner / Admin / Manager / Memberの全員が、自分のMyToDoのみ閲覧・編集可能
- Project / Task / Approvals / Manager確認 / Owner承認とは連動しない
- HOMEには未完了、期限が近い、高優先度のMyToDoだけを確認用に表示
- 新規登録、編集、削除、完了チェック、ステータス変更、期限、優先度管理はMyToDoページで実施

## TeamToDo

TeamToDoは、Project化やTask化する前のチーム共有ToDoです。

- MyToDoページ内の `TeamToDo` タブで利用
- Owner / Admin / Manager / LeaderはTeamToDoを登録・編集・削除可能
- MemberはTeamToDoを閲覧のみ
- 登録・編集時に所属内メンバーを指名でき、指名された人のMyToDoへ個別登録される
- 通常画面ではOwner/Adminでも本人のTeamToDoだけを表示
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
