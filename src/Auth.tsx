import { useState } from "react";
import { supabase } from "./lib/supabase";

export default function Auth() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async () => {
    setMessage("");
    if (!email || password.length < 6) {
      setMessage("Enter an email and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) setMessage(error.message);
      else if (!data.session) setMessage("Check your email to confirm your account, then sign in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-page">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-app px-6">
        <h1 className="text-2xl font-bold text-white">{mode === "signin" ? "Sign in" : "Create account"}</h1>
        <p className="mt-2 text-sm text-copy-muted">Your recordings are private and only visible to you.</p>
        <input
          className="mt-6 w-full rounded-2xl border border-line bg-card p-4 text-sm text-white outline-none"
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="mt-3 w-full rounded-2xl border border-line bg-card p-4 text-sm text-white outline-none"
          type="password"
          placeholder="Password (min 6 characters)"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {message && <div className="mt-3 text-xs font-semibold text-copy-muted">{message}</div>}
        <button
          className="mt-5 w-full rounded-xl bg-accent py-4 text-sm font-bold text-white disabled:opacity-60"
          disabled={busy}
          onClick={submit}
        >
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
        <button
          className="mt-4 text-sm font-semibold text-copy-muted"
          onClick={() => {
            setMessage("");
            setMode(mode === "signin" ? "signup" : "signin");
          }}
        >
          {mode === "signin" ? "No account? Sign up" : "Have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
