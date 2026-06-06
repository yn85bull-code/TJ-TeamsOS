"use client";

import { AuthUser, demoUsers } from "@/lib/auth-demo-data";
import { makeDemoAuthUser } from "@/lib/auth/profile";
import { canUseSupabaseBrowserClient } from "@/lib/supabase/client";
import { consumeSupabaseRedirectSession, signInWithPassword, updateCurrentSupabasePassword } from "@/lib/supabase/auth";
import { Building2, CheckCircle2, Eye, EyeOff, LockKeyhole, LogIn, Mail, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";

export function LoginScreen({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const [companyCode, setCompanyCode] = useState("TAUROS");
  const [email, setEmail] = useState(demoUsers[0].email);
  const [password, setPassword] = useState("demo");
  const [selectedUserId, setSelectedUserId] = useState(demoUsers[0].id);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loginMode, setLoginMode] = useState<"demo" | "supabase">("demo");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingInvite, setIsCheckingInvite] = useState(false);
  const [inviteUser, setInviteUser] = useState<AuthUser | null>(null);
  const [invitePassword, setInvitePassword] = useState("");
  const [invitePasswordConfirm, setInvitePasswordConfirm] = useState("");
  const [isSettingInvitePassword, setIsSettingInvitePassword] = useState(false);
  const selectedUser = demoUsers.find((user) => user.id === selectedUserId) ?? demoUsers[0];
  const canLogin = Boolean(companyCode.trim() && email.trim() && password.trim());
  const supabaseEnabled = canUseSupabaseBrowserClient();
  const canSetInvitePassword = invitePassword.length >= 8 && invitePassword === invitePasswordConfirm;

  useEffect(() => {
    if (!supabaseEnabled) return;

    let cancelled = false;
    setIsCheckingInvite(true);

    void consumeSupabaseRedirectSession()
      .then((result) => {
        if (cancelled || !result.user) return;
        setLoginMode("supabase");
        setEmail(result.user.email);

        if (result.isInvite) {
          setInviteUser(result.user);
          setMessage("招待リンクを確認しました。新しいパスワードを設定してください。");
          return;
        }

        onLogin(result.user);
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "招待リンクの確認に失敗しました。");
        }
      })
      .finally(() => {
        if (!cancelled) setIsCheckingInvite(false);
      });

    return () => {
      cancelled = true;
    };
  }, [onLogin, supabaseEnabled]);

  const selectDemoUser = (user: AuthUser) => {
    setSelectedUserId(user.id);
    setEmail(user.email);
    setCompanyCode("TAUROS");
    setPassword("demo");
    setLoginMode("demo");
    setMessage("");
  };

  const submitLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canLogin) {
      setMessage("会社コード、メールアドレス、パスワードを入力してください。");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      if (loginMode === "supabase") {
        if (!supabaseEnabled) {
          setMessage("Supabase接続情報が未設定です。デモログインで確認してください。");
          return;
        }

        const user = await signInWithPassword(email.trim(), password);
        onLogin(user);
        return;
      }

      const matchedUser = demoUsers.find((user) => user.email.toLowerCase() === email.trim().toLowerCase()) ?? selectedUser;
      onLogin(makeDemoAuthUser(matchedUser));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ログインに失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitInvitePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inviteUser) return;

    if (!canSetInvitePassword) {
      setMessage("パスワードは8文字以上で、確認用と一致させてください。");
      return;
    }

    setIsSettingInvitePassword(true);
    setMessage("");

    try {
      await updateCurrentSupabasePassword(invitePassword);
      onLogin(inviteUser);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "パスワード設定に失敗しました。");
    } finally {
      setIsSettingInvitePassword(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F7F8FA] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[minmax(420px,520px)_1fr]">
        <section className="flex items-center justify-center px-5 py-8 lg:px-10">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-lg bg-[#D6001C] text-sm font-black text-white">TJ</div>
              <div>
                <p className="text-sm font-bold text-[#D6001C]">TJ-TeamOS</p>
                <h1 className="text-2xl font-black tracking-tight">ログイン</h1>
              </div>
            </div>

            {isCheckingInvite ? (
              <p className="mt-5 rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
                招待リンクを確認しています。
              </p>
            ) : null}

            {inviteUser ? (
              <form className="mt-5 grid gap-3 rounded-lg border border-red-100 bg-red-50 p-4" onSubmit={submitInvitePassword}>
                <div>
                  <p className="text-sm font-black text-[#D6001C]">初回パスワード設定</p>
                  <p className="mt-1 text-xs font-bold leading-5 text-slate-600">
                    {inviteUser.name} / {inviteUser.email}
                  </p>
                </div>
                <label className="grid gap-2 text-sm font-bold text-slate-700">
                  新しいパスワード
                  <input
                    className="h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-[#D6001C] focus:ring-4 focus:ring-red-100"
                    minLength={8}
                    type="password"
                    value={invitePassword}
                    onChange={(event) => setInvitePassword(event.target.value)}
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold text-slate-700">
                  新しいパスワード（確認）
                  <input
                    className="h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-[#D6001C] focus:ring-4 focus:ring-red-100"
                    minLength={8}
                    type="password"
                    value={invitePasswordConfirm}
                    onChange={(event) => setInvitePasswordConfirm(event.target.value)}
                  />
                </label>
                <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#D6001C] px-4 text-sm font-black text-white shadow-lg shadow-red-200 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none" type="submit" disabled={!canSetInvitePassword || isSettingInvitePassword}>
                  <CheckCircle2 size={16} />
                  {isSettingInvitePassword ? "設定中" : "パスワードを設定して開始"}
                </button>
              </form>
            ) : null}

            <form className="mt-7 grid gap-4" onSubmit={submitLogin}>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
                <button
                  className={`h-9 rounded-md text-sm font-black ${loginMode === "demo" ? "bg-white text-[#D6001C] shadow-sm" : "text-slate-600"}`}
                  type="button"
                  onClick={() => {
                    setLoginMode("demo");
                    setPassword("demo");
                    setMessage("");
                  }}
                >
                  デモ
                </button>
                <button
                  className={`h-9 rounded-md text-sm font-black ${loginMode === "supabase" ? "bg-white text-[#D6001C] shadow-sm" : "text-slate-600"} disabled:text-slate-400`}
                  type="button"
                  disabled={!supabaseEnabled}
                  onClick={() => {
                    setLoginMode("supabase");
                    setMessage("");
                  }}
                >
                  本ログイン
                </button>
              </div>

              {!supabaseEnabled ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold leading-5 text-slate-500">
                  Supabase接続情報が入るまではデモログインで操作確認します。
                </p>
              ) : null}

              <label className="grid gap-2 text-sm font-bold text-slate-700">
                会社コード
                <span className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                  <input
                    className="h-11 w-full rounded-lg border border-slate-200 pl-10 pr-3 font-normal outline-none focus:border-[#D6001C] focus:ring-4 focus:ring-red-100"
                    placeholder="TAUROS"
                    required
                    value={companyCode}
                    onChange={(event) => setCompanyCode(event.target.value)}
                  />
                </span>
              </label>

              <label className="grid gap-2 text-sm font-bold text-slate-700">
                メールアドレス
                <span className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                  <input
                    className="h-11 w-full rounded-lg border border-slate-200 pl-10 pr-3 font-normal outline-none focus:border-[#D6001C] focus:ring-4 focus:ring-red-100"
                    placeholder="yamada@example.com"
                    required
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </span>
              </label>

              <label className="grid gap-2 text-sm font-bold text-slate-700">
                パスワード
                <span className="relative">
                  <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                  <input
                    className="h-11 w-full rounded-lg border border-slate-200 pl-10 pr-11 font-normal outline-none focus:border-[#D6001C] focus:ring-4 focus:ring-red-100"
                    placeholder="demo"
                    required
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" type="button" aria-label="パスワード表示切替" onClick={() => setShowPassword((value) => !value)}>
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>

              {message ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-[#D6001C]">{message}</p> : null}

              <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#D6001C] px-4 text-sm font-black text-white shadow-lg shadow-red-200 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none" type="submit" disabled={!canLogin || isSubmitting}>
                <LogIn size={17} />
                {isSubmitting ? "ログイン中" : "ログイン"}
              </button>
            </form>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black">デモアカウント</p>
                <span className="rounded bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500">パスワード demo</span>
              </div>
              <div className="mt-3 grid gap-2">
                {demoUsers.map((user) => {
                  const active = selectedUserId === user.id;
                  return (
                    <button
                      key={user.id}
                      className={`grid gap-1 rounded-lg border px-3 py-3 text-left transition ${active ? "border-[#D6001C] bg-red-50" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}
                      type="button"
                      onClick={() => selectDemoUser(user)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-sm">{user.name}</strong>
                        <span className={`rounded px-2 py-0.5 text-[11px] font-black ${active ? "bg-[#D6001C] text-white" : "bg-slate-100 text-slate-600"}`}>{user.role}</span>
                      </div>
                      <span className="text-xs text-slate-500">{user.department} / {user.position} / {user.email}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="hidden bg-[#080F14] p-8 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-bold tracking-[0.2em] text-red-300">TJ-TeamOS</p>
            <h2 className="mt-4 max-w-3xl text-5xl font-black leading-tight tracking-tight">現場を動かす。判断を止めない。</h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-slate-300">
              課題、タスク、承認、権限をひとつに。チームの進捗と意思決定を、迷わず前へ進めるWork OS。
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <LoginFeature icon={<Users size={20} />} title="見える化" body="課題とタスクを、チーム全体で共有。" />
            <LoginFeature icon={<ShieldCheck size={20} />} title="権限管理" body="必要な人だけが、必要な操作を実行。" />
            <LoginFeature icon={<CheckCircle2 size={20} />} title="承認フロー" body="確認、決裁、履歴を一本化。" />
          </div>
        </section>
      </div>
    </main>
  );
}

function LoginFeature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="grid size-10 place-items-center rounded-lg bg-white text-[#D6001C]">{icon}</div>
      <h3 className="mt-4 font-black">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
    </div>
  );
}
