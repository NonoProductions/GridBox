import { NextResponse } from "next/server";
import { authenticateStation, isAuthError } from "@/lib/espAuth";
import { createSupabaseServer } from "@/lib/supabaseServer";

/**
 * PATCH /api/esp/dispense-ack
 * Acknowledges a dispense request (sets dispense_requested = false).
 * Replaces: resetDispenseFlag() on ESP32.
 */
export async function PATCH(request: Request) {
  const station = await authenticateStation(request);
  if (isAuthError(station)) return station;

  try {
    const supabase = createSupabaseServer();

    const { error } = await supabase
      .from("stations")
      .update({ dispense_requested: false })
      .eq("id", station.id);

    if (error) {
      console.error("ESP dispense-ack error");
      return NextResponse.json(
        { error: "Update failed" },
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
