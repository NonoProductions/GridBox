"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/");
        return;
      }
      const full = (data.user.user_metadata as Record<string, unknown>)?.full_name;
      if (full && String(full).trim().length > 0) {
        router.replace("/app");
      }
    })();
  }, [router]);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Bitte gib deinen Namen ein.");
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Nicht eingeloggt.");
      const { error: updateError } = await supabase.auth.updateUser({ data: { full_name: trimmed } });
      if (updateError) throw updateError;
      
      // Check if there's a return URL from before login
      const returnUrl = localStorage.getItem('auth_return_url');
      if (returnUrl) {
        localStorage.removeItem('auth_return_url');
        router.replace(returnUrl);
      } else {
        router.replace("/app");
      }
    } catch (err: unknown) {
      setError((err as Error)?.message ?? "Konnte den Namen nicht speichern.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-0px)] bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-6">
        <h1 className="text-xl font-semibold mb-2">Wie dürfen wir dich nennen?</h1>
        <p className="text-sm text-white/70 mb-4">Bitte gib deinen Namen ein, damit wir dich begrüßen können.</p>
        {error && <div className="mb-3 text-sm text-rose-300">{error}</div>}
        <form onSubmit={saveName} className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dein Name"
            className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 outline-none focus:ring-4 focus:ring-emerald-900/40"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-600 text-white py-2.5 font-medium shadow hover:opacity-95 disabled:opacity-60"
          >
            {loading ? "Speichere…" : "Weiter"}
          </button>
        </form>
      </div>
    </main>
  );
}


