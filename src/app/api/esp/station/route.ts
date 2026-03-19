import { NextResponse } from "next/server";
import { authenticateStation, isAuthError } from "@/lib/espAuth";
import { createSupabaseServer } from "@/lib/supabaseServer";

/**
 * GET /api/esp/station
 * Returns station status including dispense_requested.
 * Replaces: getStationData() + checkDispenseRequest() on ESP32.
 */
export async function GET(request: Request) {
  const station = await authenticateStation(request);
  if (isAuthError(station)) return station;

  try {
    const supabase = createSupabaseServer();

    const { data, error } = await supabase
      .from("stations")
      .select(
        "available_units, total_units, is_active, charge_enabled, short_code, dispense_requested, slot_1_powerbank_id, slot_1_battery_voltage, slot_1_battery_percentage, slot_2_powerbank_id, slot_2_battery_voltage, slot_2_battery_percentage"
      )
      .eq("id", station.id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Station not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
