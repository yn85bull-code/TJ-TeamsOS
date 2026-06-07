"use client";

import { AuthUser, demoUsers } from "@/lib/auth-demo-data";
import { makeDemoAuthUser } from "@/lib/auth/profile";
import { canUseSupabaseBrowserClient } from "@/lib/supabase/client";
import { consumeSupabaseRedirectSession, sendPasswordResetEmail, signInWithPassword, updateCurrentSupabasePassword } from "@/lib/supabase/auth";
import { Building2, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useEffect, useState } from "react";

export function LoginScreen({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const [companyCode, setCompanyCode] = useState("TAUROS");
  const [email, setEmail] = useState(demoUsers[0].email);
  const [password, setPassword] = useState("demo");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loginMode, setLoginMode] = useState<"demo" | "supabase">("demo");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [isCheckingInvite, setIsCheckingInvite] = useState(false);
  const [inviteUser, setInviteUser] = useState<AuthUser | null>(null);
  const [invitePassword, setInvitePassword] = useState("");
  const [invitePasswordConfirm, setInvitePasswordConfirm] = useState("");
  const [isSettingInvitePassword, setIsSettingInvitePassword] = useState(false);
  const canLogin = Boolean(companyCode.trim() && email.trim() && password.trim());
  const supabaseEnabled = canUseSupabaseBrowserClient();
  const canSetInvitePassword = invitePassword.length >= 8 && invitePassword === invitePasswordConfirm;

  useEffect(() => {
    if (!supabaseEnabled) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setIsCheckingInvite(true);
    });

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

      const matchedUser = demoUsers.find((user) => user.email.toLowerCase() === email.trim().toLowerCase()) ?? demoUsers[0];
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

  const sendPasswordReset = async () => {
    const targetEmail = email.trim();
    setLoginMode("supabase");

    if (!targetEmail) {
      setMessage("パスワード再設定メールを送るメールアドレスを入力してください。");
      return;
    }
    if (!supabaseEnabled) {
      setMessage("Supabase接続情報が未設定です。管理者に確認してください。");
      return;
    }

    setIsSendingReset(true);
    setMessage("");

    try {
      await sendPasswordResetEmail(targetEmail);
      setMessage("パスワード再設定メールを送信しました。メール内リンクから新しいパスワードを設定してください。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "パスワード再設定メールの送信に失敗しました。");
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-slate-950">
      <LoginSoftBackground />

      <section className="relative z-10 flex min-h-screen items-center justify-center px-5 py-8 sm:px-8">
        <div className="w-full max-w-[360px] rounded-lg border border-slate-100 bg-white/95 p-5 shadow-2xl shadow-red-100/80 backdrop-blur sm:max-w-[500px] sm:p-8 lg:p-10">
          <AuthBrand />

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
              <LoginPasswordInput
                label="新しいパスワード"
                placeholder="8文字以上で入力"
                value={invitePassword}
                onChange={setInvitePassword}
              />
              <LoginPasswordInput
                label="新しいパスワード（確認）"
                placeholder="もう一度入力"
                value={invitePasswordConfirm}
                onChange={setInvitePasswordConfirm}
              />
              <button className="h-11 rounded-lg bg-[#D6001C] px-4 text-sm font-black text-white shadow-lg shadow-red-200 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none" type="submit" disabled={!canSetInvitePassword || isSettingInvitePassword}>
                {isSettingInvitePassword ? "設定中" : "パスワードを設定して開始"}
              </button>
            </form>
          ) : null}

          <form className="mt-7 grid gap-4" onSubmit={submitLogin}>
            <h1 className="text-center text-xl font-black tracking-tight sm:text-2xl">ログイン</h1>

            <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-[2px]">
              <button
                className={`h-10 rounded-md text-sm font-black transition ${loginMode === "demo" ? "border border-red-200 bg-red-50 text-[#D6001C]" : "text-slate-500 hover:bg-slate-50"}`}
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
                className={`h-10 rounded-md text-sm font-black transition ${loginMode === "supabase" ? "border border-red-200 bg-red-50 text-[#D6001C]" : "text-slate-500 hover:bg-slate-50"} disabled:text-slate-400`}
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

            <LoginTextInput
              icon={<Building2 size={17} />}
              label="会社コード"
              placeholder="例） tjeam"
              value={companyCode}
              onChange={setCompanyCode}
            />
            <LoginTextInput
              icon={<Mail size={17} />}
              label="メールアドレス"
              placeholder="you@example.com"
              type="email"
              value={email}
              onChange={setEmail}
            />

            <label className="grid gap-2 text-sm font-black text-slate-700">
              パスワード
              <span className="relative">
                <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-11 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#D6001C] focus:ring-4 focus:ring-red-100"
                  placeholder="パスワードを入力"
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

            <button className="mt-1 h-12 rounded-lg bg-[#D6001C] px-4 text-sm font-black text-white shadow-lg shadow-red-200 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none" type="submit" disabled={!canLogin || isSubmitting}>
              {isSubmitting ? "ログイン中" : "ログイン"}
            </button>

            <button
              className="h-10 text-sm font-black text-[#D6001C] transition hover:text-red-700 disabled:cursor-not-allowed disabled:text-slate-400"
              type="button"
              disabled={isSendingReset}
              onClick={() => void sendPasswordReset()}
            >
              {isSendingReset ? "再設定メールを送信中" : "パスワードを忘れた方"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function AuthBrand() {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className="grid size-16 place-items-center rounded-lg bg-[#D6001C] text-2xl font-black text-white shadow-lg shadow-red-200">TJ</div>
      <div>
        <p className="mt-5 text-3xl font-black tracking-tight text-slate-950">TJ-TeamOS</p>
        <p className="mt-1 text-sm font-bold italic text-slate-500">Work OS / MWP</p>
      </div>
    </div>
  );
}

function LoginTextInput({
  icon,
  label,
  placeholder,
  type = "text",
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  placeholder: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-black text-slate-700">
      {label}
      <span className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
        <input
          className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#D6001C] focus:ring-4 focus:ring-red-100"
          placeholder={placeholder}
          required
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </label>
  );
}

function LoginPasswordInput({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-black text-slate-700">
      {label}
      <input
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none transition focus:border-[#D6001C] focus:ring-4 focus:ring-red-100"
        minLength={8}
        placeholder={placeholder}
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function LoginSoftBackground() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1440 900" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="loginGlow" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#E60012" stopOpacity="0.18" />
          <stop offset="55%" stopColor="#E60012" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#E60012" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="loginCorner" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#E60012" stopOpacity="0.62" />
          <stop offset="100%" stopColor="#E60012" stopOpacity="0.14" />
        </linearGradient>
      </defs>

      <rect width="1440" height="900" fill="white" />
      <circle cx="718" cy="472" r="390" fill="url(#loginGlow)" />
      <path d="M0 575 C132 775 312 858 558 900 H0Z" fill="url(#loginCorner)" />
      <path d="M1440 720 C1390 785 1348 845 1308 900 H1440Z" fill="#E60012" opacity="0.76" />
      <g fill="none" stroke="#E60012" strokeOpacity="0.13" strokeWidth="1.5">
        <circle cx="720" cy="470" r="455" />
        <circle cx="720" cy="470" r="350" />
        <path d="M155 820 C338 704 530 760 716 738 C936 712 1125 620 1328 662" />
        <path d="M0 778 C235 652 430 724 690 690 C914 660 1110 542 1440 575" />
        <path d="M110 125 C332 22 528 64 725 154 C952 258 1120 200 1295 110" />
      </g>
      <g fill="none" stroke="#E60012" strokeOpacity="0.08" strokeWidth="1">
        <path d="M0 830 C250 748 466 884 706 808 C920 740 1136 710 1440 807" />
        <path d="M0 850 C250 768 466 904 706 828 C920 760 1136 730 1440 827" />
        <path d="M0 870 C250 788 466 924 706 848 C920 780 1136 750 1440 847" />
      </g>
    </svg>
  );
}
