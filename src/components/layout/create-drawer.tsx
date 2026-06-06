import { ClipboardList, X } from "lucide-react";
import { useState } from "react";
import { DEFAULT_DEPARTMENTS, normalizeDepartmentList } from "@/lib/workspace/department-store";

export type CreateDrawerPayload = {
  type: "issue";
  title: string;
  dueDate: string;
  displayDueDate: string;
  department: string;
  category1: string;
  category2: string;
  registrant: string;
  priority: string;
  asIs: string;
  toBe: string;
  registeredAt: string;
  label: string;
};

export function CreateDrawer({
  open,
  onClose,
  onCreated,
  departmentOptions = DEFAULT_DEPARTMENTS,
  currentUserName = "山田 太郎",
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (payload: CreateDrawerPayload) => void;
  departmentOptions?: string[];
  currentUserName?: string;
}) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [department, setDepartment] = useState("");
  const [category1, setCategory1] = useState("事業課題");
  const [category2, setCategory2] = useState("顕在課題");
  const [priority, setPriority] = useState("Must");
  const [asIs, setAsIs] = useState("");
  const [toBe, setToBe] = useState("");
  const departments = normalizeDepartmentList(departmentOptions.length ? departmentOptions : DEFAULT_DEPARTMENTS);

  if (!open) return null;

  const registrationDateTime = formatDateTime(new Date());
  const canSubmit = Boolean(title.trim() && dueDate && department.trim() && asIs.trim() && toBe.trim());
  const resetForm = () => {
    setTitle("");
    setDueDate("");
    setDepartment("");
    setCategory1("事業課題");
    setCategory2("顕在課題");
    setPriority("Must");
    setAsIs("");
    setToBe("");
  };
  const closeDrawer = () => {
    resetForm();
    onClose();
  };
  const helperText = "課題は、現状の困りごとや改善テーマです。課題を登録し、必要に応じて具体的なタスクへ振り分けます。";

  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-slate-950/40" type="button" aria-label="閉じる" onClick={closeDrawer} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-sm font-bold text-[#D6001C]">Create</p>
            <h2 className="text-xl font-black">新規作成</h2>
          </div>
          <button className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-600" type="button" onClick={closeDrawer}>
            <X size={18} />
          </button>
        </header>

        <div className="grid gap-5 overflow-y-auto p-6">
          <section className="rounded-xl border border-red-100 bg-red-50 p-4">
            <ClipboardList className="text-[#D6001C]" size={22} />
            <h3 className="mt-3 font-bold text-slate-950">課題を登録</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">As-Is、To-Be、分類、登録者、期限を登録します。タスク化と承認申請は登録後の課題フローから行います。</p>
          </section>

          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canSubmit) return;
              onCreated({
                type: "issue",
                title: title.trim(),
                dueDate,
                displayDueDate: formatDateForDisplay(dueDate),
                department: department.trim(),
                category1,
                category2,
                registrant: currentUserName,
                priority,
                asIs: asIs.trim(),
                toBe: toBe.trim(),
                registeredAt: registrationDateTime,
                label: "課題を作成",
              });
              resetForm();
            }}
          >
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
              {helperText}
            </div>

            <div className="grid gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-600">
              <div>
                <p className="font-bold text-slate-800">課題分類大区分</p>
                <p><strong>事業課題:</strong> 売上・利益・出店・集客・サービス拡大など、事業成長に関わる課題。</p>
                <p><strong>組織課題:</strong> 人・体制・役割・責任範囲・評価・マネジメントの課題。</p>
                <p><strong>業務課題:</strong> 日々のオペレーション・手順・処理漏れ・業務フローの課題。</p>
              </div>
              <div>
                <p className="font-bold text-slate-800">課題分類小区分</p>
                <p><strong>顕在課題:</strong> すでに問題として見えており、業務や数字に影響が出ている課題。</p>
                <p><strong>潜在課題:</strong> まだ大きな問題にはなっていないが、将来的にリスクになる可能性がある課題。</p>
              </div>
            </div>

            <label className="grid gap-2 text-sm font-bold text-slate-700">
              <span className="flex items-center gap-2">タイトル <RequiredBadge /></span>
              <input
                className="h-11 rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-[#D6001C] focus:ring-4 focus:ring-red-100"
                placeholder="例: 営業研修資料の更新"
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-slate-700">
              登録日時 / 発生日
              <input className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-sm font-semibold text-slate-700 outline-none" value={registrationDateTime} readOnly />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                課題分類大区分
                <select className="h-11 rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-[#D6001C]" value={category1} onChange={(event) => setCategory1(event.target.value)}>
                  <option>事業課題</option>
                  <option>組織課題</option>
                  <option>業務課題</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                課題分類小区分
                <select className="h-11 rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-[#D6001C]" value={category2} onChange={(event) => setCategory2(event.target.value)}>
                  <option>顕在課題</option>
                  <option>潜在課題</option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                登録者
                <input className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 font-normal text-slate-700 outline-none" value={currentUserName} readOnly />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                <span className="flex items-center gap-2">期限 <RequiredBadge /></span>
                <input
                  className="h-11 rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-[#D6001C]"
                  type="date"
                  required
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                優先度
                <select className="h-11 rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-[#D6001C]" value={priority} onChange={(event) => setPriority(event.target.value)}>
                  <option>Must</option>
                  <option>Should</option>
                  <option>Could</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                <span className="flex items-center gap-2">部門 <RequiredBadge /></span>
                <select
                  className="h-11 rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-[#D6001C] focus:ring-4 focus:ring-red-100"
                  required
                  value={department}
                  onChange={(event) => setDepartment(event.target.value)}
                >
                  <option value="">部門を選択</option>
                  {departments.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="grid gap-2 text-sm font-bold text-slate-700">
              <span className="flex items-center gap-2">As-Is <RequiredBadge /></span>
              <textarea
                className="min-h-32 rounded-lg border border-slate-200 px-3 py-2 font-normal outline-none focus:border-[#D6001C] focus:ring-4 focus:ring-red-100"
                placeholder="現状の課題や困っている状態を入力"
                required
                value={asIs}
                onChange={(event) => setAsIs(event.target.value)}
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-slate-700">
              <span className="flex items-center gap-2">To-Be <RequiredBadge /></span>
              <textarea
                className="min-h-32 rounded-lg border border-slate-200 px-3 py-2 font-normal outline-none focus:border-[#D6001C] focus:ring-4 focus:ring-red-100"
                placeholder="完了後にどのような状態にしたいかを入力"
                required
                value={toBe}
                onChange={(event) => setToBe(event.target.value)}
              />
            </label>

            <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
              <button className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700" type="button" onClick={closeDrawer}>
                キャンセル
              </button>
              <button className="h-10 rounded-lg bg-[#D6001C] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300" type="submit" disabled={!canSubmit}>
                登録
              </button>
            </div>
          </form>
        </div>
      </aside>
    </div>
  );
}

function RequiredBadge() {
  return <span className="rounded bg-red-50 px-2 py-0.5 text-[11px] font-black text-[#D6001C]">必須</span>;
}

function formatDateForDisplay(value: string) {
  if (!value) return "";
  const [, month, day] = value.split("-");
  return `${month}/${day}`;
}

function formatDateTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}/${month}/${day} ${hours}:${minutes}`;
}
