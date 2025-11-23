import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: Request) {
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Supabase Service Role Konfiguration fehlt");
    return NextResponse.json(
      { message: "Supabase Service Role Konfiguration fehlt" },
      { status: 500 }
    );
  }

  const authorization =
    request.headers.get("authorization") ||
    request.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ message: "Nicht authentifiziert" }, { status: 401 });
  }

  const token = authorization.replace("Bearer", "").trim();
  if (!token) {
    return NextResponse.json({ message: "Nicht authentifiziert" }, { status: 401 });
  }

  const supabaseServer = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const {
    data: userData,
    error: userError,
  } = await supabaseServer.auth.getUser(token);

  if (userError || !userData?.user) {
    console.error("Fehler bei der Token-Verifikation:", userError);
    return NextResponse.json({ message: "Nicht authentifiziert" }, { status: 401 });
  }

  const { data: roleData, error: roleError } = await supabaseServer
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (roleError) {
    console.error("Fehler beim Prüfen der Benutzerrolle:", roleError);
    return NextResponse.json(
      { message: "Rollenprüfung fehlgeschlagen" },
      { status: 500 }
    );
  }

  if (roleData?.role !== "owner") {
    return NextResponse.json({ message: "Keine Berechtigung" }, { status: 403 });
  }

  const { data, error } = await supabaseServer
    .from("profiles")
    .select("id, email, role, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fehler beim Laden der Benutzer:", error);
    return NextResponse.json(
      { message: "Fehler beim Laden der Benutzer" },
      { status: 500 }
    );
  }

  const users =
    data?.map((profile) => ({
      user_id: profile.id,
      email: profile.email,
      role: profile.role,
      created_at: profile.created_at,
    })) ?? [];

  return NextResponse.json({ users });
}

