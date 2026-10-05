import { FormEvent, useState } from "react";
import { supabase } from "./lib/supabase";

export default function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    if (!supabase) {
      setError("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.");
      setBusy(false); return;
    }
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password });
    if (result.error) setError(result.error.message);
    else if (mode === "signup") setMessage("Account created. Check your email if confirmation is enabled, then sign in.");
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-page px-5 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
        <div className="w-full rounded-[2rem] border border-line bg-app p-6 shadow-phone">
          <div className="mb-8">
            <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-accent text-white shadow-glow">◈</div>
            <p className="text-xs font-bold uppercase tracking-widest text-accent-bright">Audio Notes</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-copy-muted">
              Your recordings, uploads and AI notes stay connected to your account.
            </p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <label className="block"><span className="mb-2 block text-xs font-semibold text-copy-muted">Email</span>
              <input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="focus-ring w-full rounded-xl border border-line bg-card px-4 py-3 text-sm text-white outline-none" placeholder="you@example.com" />
            </label>
            <label className="block"><span className="mb-2 block text-xs font-semibold text-copy-muted">Password</span>
              <input required minLength={6} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={e => setPassword(e.target.value)} className="focus-ring w-full rounded-xl border border-line bg-card px-4 py-3 text-sm text-white outline-none" placeholder="At least 6 characters" />
            </label>
            {error && <p className="rounded-xl border border-red/30 bg-red/10 p-3 text-xs leading-5 text-red">{error}</p>}
            {message && <p className="rounded-xl border border-green/30 bg-green/10 p-3 text-xs leading-5 text-green">{message}</p>}
            <button disabled={busy} className="w-full rounded-xl bg-gradient-to-r from-accent to-purple px-4 py-4 text-sm font-bold text-white shadow-glow disabled:opacity-50">
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
          <button className="mt-5 w-full text-center text-sm font-semibold text-accent-bright" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setMessage(""); }}>
            {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
