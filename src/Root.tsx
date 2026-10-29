import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import App from "./App";
import Auth from "./Auth";

export default function Root() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "SIGNED_OUT" || !next) {
        try {
          localStorage.removeItem("leasy_profile_cache");
          localStorage.removeItem("leasy_stats_cache");
          localStorage.removeItem("leasy_schedule");
          localStorage.removeItem("leasy_schedule_ts");
        } catch {}
      }
      setSession(next);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!ready) return <div className="min-h-screen bg-page" />;
  return session ? <App key={session.user.id} /> : <Auth />;
}
