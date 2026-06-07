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
      <LoginNetworkBackground />
      <div className="pointer-events-none absolute left-0 top-0 hidden size-44 bg-[#D6001C] lg:block" style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }} />
      <div className="pointer-events-none absolute bottom-0 right-0 size-56 bg-[#D6001C]" style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }} />

      <section className="relative z-10 flex min-h-screen items-center justify-center px-5 py-8 sm:px-8 lg:justify-start lg:px-[7vw]">
        <div className="w-full max-w-[360px] rounded-lg border border-slate-100 bg-white/95 p-5 shadow-2xl shadow-slate-200/80 backdrop-blur sm:max-w-[430px] sm:p-7 lg:max-w-[540px] lg:p-8">
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

            <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 bg-white p-[2px]">
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
    <div className="flex items-center justify-center gap-4">
      <div className="grid size-14 place-items-center rounded-lg bg-[#D6001C] text-xl font-black text-white shadow-lg shadow-red-200">TJ</div>
      <div>
        <p className="text-2xl font-black tracking-tight text-slate-950">TJ-TeamOS</p>
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

function LoginNetworkBackground() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1440 900" role="img" aria-label="TJ-TeamOS network background" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="loginDotPattern" width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.6" fill="#E60012" />
        </pattern>
        <linearGradient id="loginArcGradient" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#E60012" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#E60012" stopOpacity="0.08" />
        </linearGradient>
      </defs>

      <rect width="1440" height="900" fill="white" />
      <g fill="none" stroke="url(#loginArcGradient)" strokeWidth="1.2">
        <path d="M360 500 C560 110 760 40 950 220" />
        <path d="M410 560 C610 190 760 115 1020 235" />
        <path d="M450 640 C630 270 835 275 1140 410" />
        <path d="M520 710 C760 420 930 385 1290 520" />
        <path d="M40 820 C340 700 610 690 910 355" />
        <path d="M0 845 C300 745 590 760 1060 520" />
      </g>

      <g opacity="0.9">
        <ellipse cx="940" cy="180" rx="44" ry="62" fill="url(#loginDotPattern)" transform="rotate(-18 940 180)" />
        <path d="M845 235 C910 270 920 355 865 430 C822 492 734 485 675 535 C640 565 585 590 520 562 C575 510 635 485 682 442 C735 392 750 315 845 235Z" fill="url(#loginDotPattern)" />
        <path d="M555 560 C505 620 438 680 382 742 C337 704 365 642 430 604 C475 578 512 560 555 560Z" fill="url(#loginDotPattern)" />
        <path d="M612 592 C660 582 710 590 755 620 C704 648 650 648 602 627Z" fill="url(#loginDotPattern)" />
      </g>

      <g fill="#E60012" opacity="0.55">
        {[
          [702, 430], [820, 372], [885, 500], [940, 235], [750, 610], [575, 560], [835, 82], [1115, 388],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="5" fill="white" stroke="#E60012" strokeWidth="2" />
        ))}
      </g>

      <g fill="none" stroke="#E60012" strokeOpacity="0.13" strokeWidth="1">
        <path d="M0 790 C260 710 470 865 710 778 C910 705 1110 682 1440 800" />
        <path d="M0 810 C260 730 470 885 710 798 C910 725 1110 702 1440 820" />
        <path d="M0 830 C260 750 470 905 710 818 C910 745 1110 722 1440 840" />
        <path d="M0 850 C260 770 470 925 710 838 C910 765 1110 742 1440 860" />
        <path d="M0 870 C260 790 470 945 710 858 C910 785 1110 762 1440 880" />
      </g>
    </svg>
  );
}
