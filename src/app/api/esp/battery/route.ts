import { NextResponse } from "next/server";
import { authenticateStation, isAuthError } from "@/lib/espAuth";
import { createSupabaseServer } from "@/lib/supabaseServer";

/**
 * PATCH /api/esp/battery
 * Updates battery data + serves as heartbeat (updated_at is set by DB trigger).
 * Replaces: updateBatteryData() on ESP32.
 *
 * Body: { powerbank_id, battery_voltage, battery_percentage }
 *   or  { powerbank_id: null, battery_voltage: null, battery_percentage: null }
 */
export async function PATCH(request: Request) {
  const station = await authenticateStation(request);
  if (isAuthError(station)) return station;

  try {
    const body = await request.json();

    // Validate and sanitize fields
    const update: Record<string, unknown> = {};

    if (body.battery_voltage === null || body.battery_voltage === undefined) {
      update.battery_voltage = null;
    } else {
      const v = Number(body.battery_voltage);
      if (isNaN(v) || v < 0 || v > 5.0) {
        return NextResponse.json(
          { error: "battery_voltage must be 0-5.0 or null" },
          { status: 400 }
        );
      }
      update.battery_voltage = Math.round(v * 100) / 100;
    }

    if (
      body.battery_percentage === null ||
      body.battery_percentage === undefined
    ) {
      update.battery_percentage = null;
    } else {
      const p = Math.round(Number(body.battery_percentage));
      if (isNaN(p) || p < 0 || p > 100) {
        return NextResponse.json(
          { error: "battery_percentage must be 0-100 or null" },
          { status: 400 }
        );
      }
      update.battery_percentage = p;
    }

    // powerbank_id: string or null
    if (body.powerbank_id === null || body.powerbank_id === undefined) {
      update.powerbank_id = null;
    } else {
      const id = String(body.powerbank_id).trim().slice(0, 64);
      if (id.length === 0) {
        update.powerbank_id = null;
      } else {
        update.powerbank_id = id;
      }
    }

    const supabase = createSupabaseServer();

    const { error } = await supabase
      .from("stations")
      .update(update)
      .eq("id", station.id);

    if (error) {
      console.error("ESP battery update error:", error.message);
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
