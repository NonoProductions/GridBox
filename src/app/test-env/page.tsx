"use client";

export default function TestEnv() {
  const envVars = {
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✓ SET" : "✗ MISSING",
    MAPTILER_KEY: process.env.NEXT_PUBLIC_MAPTILER_API_KEY ? "✓ SET" : "✗ MISSING",
  };

  return (
    <div style={{ padding: "20px", fontFamily: "monospace" }}>
      <h1>Environment Variables Test</h1>
      <pre>{JSON.stringify(envVars, null, 2)}</pre>
      
      <h2>Details:</h2>
      <ul>
        <li>NEXT_PUBLIC_SUPABASE_URL: {envVars.SUPABASE_URL || "❌ MISSING"}</li>
        <li>NEXT_PUBLIC_SUPABASE_ANON_KEY: {envVars.SUPABASE_KEY}</li>
        <li>NEXT_PUBLIC_MAPTILER_API_KEY: {envVars.MAPTILER_KEY}</li>
      </ul>
    </div>
  );
}

