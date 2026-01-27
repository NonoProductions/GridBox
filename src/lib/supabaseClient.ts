import { createClient } from "@supabase/supabase-js";

// Environment variables - validate and fail fast if missing
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Validate required environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = "Missing required Supabase environment variables";
  if (typeof window === 'undefined') {
    // Server-side: throw error to prevent app from starting
    throw new Error(`${errorMsg}. NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.`);
  } else {
    // Client-side: log error but don't crash
    console.error("⚠️", errorMsg);
    console.error("NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✓ Set" : "✗ Missing");
    console.error("NEXT_PUBLIC_SUPABASE_ANON_KEY:", supabaseAnonKey ? "✓ Set" : "✗ Missing");
  }
}

// Validate URL format
if (supabaseUrl && !supabaseUrl.match(/^https?:\/\/.+/)) {
  throw new Error("Invalid NEXT_PUBLIC_SUPABASE_URL format. Must be a valid HTTP(S) URL.");
}

// Create Supabase client with security-focused configuration
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce', // Use PKCE flow for better security
    },
    global: {
      headers: {
        'X-Client-Info': 'gridbox-pwa',
      },
    },
  }
);
