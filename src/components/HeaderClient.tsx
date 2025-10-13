"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function HeaderClient() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
  }

  return (
    <header style={{display:"flex",gap:16,alignItems:"center",padding:12,borderBottom:"1px solid #ddd"}}>
      <Link href="/">GridBox</Link>
      <Link href="/login">Login</Link>
      <Link href="/dashboard">Dashboard</Link>
      <div style={{marginLeft:"auto"}}>
        {email ? (
          <>
            <span style={{marginRight:12}}>angemeldet: {email}</span>
            <button onClick={logout}>Logout</button>
          </>
        ) : (
          <span>nicht angemeldet</span>
        )}
      </div>
    </header>
  );
}
