import { NextResponse } from "next/server";
import { authenticateStation, isAuthError } from "@/lib/espAuth";
import { createSupabaseServer } from "@/lib/supabaseServer";

/**
 * POST /api/esp/rollback
 * Rolls back a failed dispense via Supabase RPC.
 * Replaces: rollbackFailedDispense() on ESP32.
 */
export async function POST(request: Request) {
  const station = await authenticateStation(request);
  if (isAuthError(station)) return station;

  try {
    const supabase = createSupabaseServer();

    const { error } = await supabase.rpc("rollback_failed_dispense", {
      p_station_id: station.id,
    });

    if (error) {
      console.error("ESP rollback RPC error:", error.message);
      return NextResponse.json(
        { error: "Rollback failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
