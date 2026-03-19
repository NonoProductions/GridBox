import { NextResponse } from "next/server";
import { authenticateStation, isAuthError } from "@/lib/espAuth";
import { createSupabaseServer } from "@/lib/supabaseServer";

/**
 * PATCH /api/esp/units
 * Updates available_units and/or total_units.
 * Replaces: updateAvailableUnits() + syncTotalUnits() on ESP32.
 *
 * Body: { available_units?: number, total_units?: number }
 */
export async function PATCH(request: Request) {
  const station = await authenticateStation(request);
  if (isAuthError(station)) return station;

  try {
    const body = await request.json();
    const update: Record<string, unknown> = {};

    if (body.available_units !== undefined) {
      const n = Math.round(Number(body.available_units));
      if (isNaN(n) || n < 0 || n > 100) {
        return NextResponse.json(
          { error: "available_units must be 0-100" },
          { status: 400 }
        );
      }
      update.available_units = n;
    }

    if (body.total_units !== undefined) {
      const n = Math.round(Number(body.total_units));
      if (isNaN(n) || n < 0 || n > 100) {
        return NextResponse.json(
          { error: "total_units must be 0-100" },
          { status: 400 }
        );
      }
      update.total_units = n;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServer();

    const { error } = await supabase
      .from("stations")
      .update(update)
      .eq("id", station.id);

    if (error) {
      console.error("ESP units update error");
      return NextResponse.json(
        { error: "Update failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
