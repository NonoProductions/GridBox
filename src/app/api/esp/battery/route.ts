import { NextResponse } from "next/server";
import { authenticateStation, isAuthError } from "@/lib/espAuth";
import { createSupabaseServer } from "@/lib/supabaseServer";

/**
 * PATCH /api/esp/battery
 * Updates battery data + serves as heartbeat (updated_at is set by DB trigger).
 * Supports dual-slot: slot_1_* and slot_2_* fields, plus legacy single fields.
 *
 * Body: { slot_1_powerbank_id, slot_1_battery_voltage, slot_1_battery_percentage,
 *         slot_2_powerbank_id, slot_2_battery_voltage, slot_2_battery_percentage,
 *         powerbank_id, battery_voltage, battery_percentage }
 */
export async function PATCH(request: Request) {
  const station = await authenticateStation(request);
  if (isAuthError(station)) return station;

  try {
    const body = await request.json();

    const update: Record<string, unknown> = {};

    // Helper: validate voltage (0-5.0 or null)
    const parseVoltage = (val: unknown): number | null => {
      if (val === null || val === undefined) return null;
      const v = Number(val);
      if (isNaN(v) || v < 0 || v > 5.0) return undefined as unknown as null; // signal invalid
      return Math.round(v * 100) / 100;
    };

    // Helper: validate percentage (0-100 or null)
    const parsePercentage = (val: unknown): number | null => {
      if (val === null || val === undefined) return null;
      const p = Math.round(Number(val));
      if (isNaN(p) || p < 0 || p > 100) return undefined as unknown as null;
      return p;
    };

    // Helper: validate powerbank_id (alphanumeric string or null)
    const parsePowerbankId = (val: unknown): string | null => {
      if (val === null || val === undefined) return null;
      const id = String(val).trim().slice(0, 64);
      if (id.length === 0) return null;
      // Only allow alphanumeric, hyphens, and underscores
      if (!/^[A-Za-z0-9_-]+$/.test(id)) return null;
      return id;
    };

    // --- Slot 1 fields ---
    if ("slot_1_battery_voltage" in body) {
      const v = parseVoltage(body.slot_1_battery_voltage);
      if (v === (undefined as unknown)) {
        return NextResponse.json({ error: "slot_1_battery_voltage must be 0-5.0 or null" }, { status: 400 });
      }
      update.slot_1_battery_voltage = v;
    }
    if ("slot_1_battery_percentage" in body) {
      const p = parsePercentage(body.slot_1_battery_percentage);
      if (p === (undefined as unknown)) {
        return NextResponse.json({ error: "slot_1_battery_percentage must be 0-100 or null" }, { status: 400 });
      }
      update.slot_1_battery_percentage = p;
    }
    if ("slot_1_powerbank_id" in body) {
      update.slot_1_powerbank_id = parsePowerbankId(body.slot_1_powerbank_id);
    }

    // --- Slot 2 fields ---
    if ("slot_2_battery_voltage" in body) {
      const v = parseVoltage(body.slot_2_battery_voltage);
      if (v === (undefined as unknown)) {
        return NextResponse.json({ error: "slot_2_battery_voltage must be 0-5.0 or null" }, { status: 400 });
      }
      update.slot_2_battery_voltage = v;
    }
    if ("slot_2_battery_percentage" in body) {
      const p = parsePercentage(body.slot_2_battery_percentage);
      if (p === (undefined as unknown)) {
        return NextResponse.json({ error: "slot_2_battery_percentage must be 0-100 or null" }, { status: 400 });
      }
      update.slot_2_battery_percentage = p;
    }
    if ("slot_2_powerbank_id" in body) {
      update.slot_2_powerbank_id = parsePowerbankId(body.slot_2_powerbank_id);
    }

    // --- Legacy single fields (backward compatibility) ---
    if ("battery_voltage" in body) {
      const v = parseVoltage(body.battery_voltage);
      if (v === (undefined as unknown)) {
        return NextResponse.json({ error: "battery_voltage must be 0-5.0 or null" }, { status: 400 });
      }
      update.battery_voltage = v;
    }
    if ("battery_percentage" in body) {
      const p = parsePercentage(body.battery_percentage);
      if (p === (undefined as unknown)) {
        return NextResponse.json({ error: "battery_percentage must be 0-100 or null" }, { status: 400 });
      }
      update.battery_percentage = p;
    }
    if ("powerbank_id" in body) {
      update.powerbank_id = parsePowerbankId(body.powerbank_id);
    }

    const supabase = createSupabaseServer();

    const { error } = await supabase
      .from("stations")
      .update(update)
      .eq("id", station.id);

    if (error) {
      console.error("ESP battery update error");
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
