import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client with the service role key (server-side only).
 * This client bypasses RLS and should ONLY be used in API routes / server code.
 */
export function createSupabaseServer(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
