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
    const supabase = createSupabaseServer();

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

    const hasPerSlotFields =
      "slot_1_powerbank_id" in body ||
      "slot_1_battery_voltage" in body ||
      "slot_1_battery_percentage" in body ||
      "slot_2_powerbank_id" in body ||
      "slot_2_battery_voltage" in body ||
      "slot_2_battery_percentage" in body;

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

    // --- Legacy single fields ---
    // Wenn Slot-Felder gesendet werden, Legacy-Felder auf NULL halten.
    // So vermeiden wir bei Dual-Slot ein irrefuehrendes NULL -> ID Toggle auf powerbank_id.
    if (hasPerSlotFields) {
      // Legacy-Kompatibilität fuer Alt-Trigger:
      // Setze powerbank_id nur dann, wenn eine Powerbank NEU eingesteckt wurde
      // (Bestand steigt). Bei Entnahme/gleichbleibendem Bestand bleibt Legacy NULL,
      // damit kein falsches Rueckgabe-Event ausgeloest wird.
      const { data: currentStation, error: currentStationError } = await supabase
        .from("stations")
        .select("slot_1_powerbank_id, slot_2_powerbank_id, slot_1_battery_voltage, slot_1_battery_percentage, slot_2_battery_voltage, slot_2_battery_percentage")
        .eq("id", station.id)
        .maybeSingle();

      if (currentStationError) {
        console.error("ESP battery legacy-compat lookup error");
        update.powerbank_id = null;
      } else {
        const oldSlot1Id = parsePowerbankId(currentStation?.slot_1_powerbank_id);
        const oldSlot2Id = parsePowerbankId(currentStation?.slot_2_powerbank_id);

        const newSlot1Id = "slot_1_powerbank_id" in body
          ? parsePowerbankId(body.slot_1_powerbank_id)
          : oldSlot1Id;
        const newSlot2Id = "slot_2_powerbank_id" in body
          ? parsePowerbankId(body.slot_2_powerbank_id)
          : oldSlot2Id;

        const oldIds = [oldSlot1Id, oldSlot2Id].filter((id): id is string => id !== null);
        const newIds = [newSlot1Id, newSlot2Id].filter((id): id is string => id !== null);
        const insertedIds = newIds.filter((id) => !oldIds.includes(id));

        const isPresent = (id: string | null, voltage: number | null, percentage: number | null): boolean =>
          id !== null || (voltage !== null && percentage !== null);

        const oldSlot1Voltage = parseVoltage(currentStation?.slot_1_battery_voltage);
        const oldSlot1Percentage = parsePercentage(currentStation?.slot_1_battery_percentage);
        const oldSlot2Voltage = parseVoltage(currentStation?.slot_2_battery_voltage);
        const oldSlot2Percentage = parsePercentage(currentStation?.slot_2_battery_percentage);

        const newSlot1Voltage = "slot_1_battery_voltage" in body
          ? parseVoltage(body.slot_1_battery_voltage)
          : oldSlot1Voltage;
        const newSlot1Percentage = "slot_1_battery_percentage" in body
          ? parsePercentage(body.slot_1_battery_percentage)
          : oldSlot1Percentage;
        const newSlot2Voltage = "slot_2_battery_voltage" in body
          ? parseVoltage(body.slot_2_battery_voltage)
          : oldSlot2Voltage;
        const newSlot2Percentage = "slot_2_battery_percentage" in body
          ? parsePercentage(body.slot_2_battery_percentage)
          : oldSlot2Percentage;

        const oldSlot1Present = isPresent(oldSlot1Id, oldSlot1Voltage, oldSlot1Percentage);
        const oldSlot2Present = isPresent(oldSlot2Id, oldSlot2Voltage, oldSlot2Percentage);
        const newSlot1Present = isPresent(newSlot1Id, newSlot1Voltage, newSlot1Percentage);
        const newSlot2Present = isPresent(newSlot2Id, newSlot2Voltage, newSlot2Percentage);

        const oldPresentCount = (oldSlot1Present ? 1 : 0) + (oldSlot2Present ? 1 : 0);
        const newPresentCount = (newSlot1Present ? 1 : 0) + (newSlot2Present ? 1 : 0);

        if (insertedIds.length > 0) {
          update.powerbank_id = insertedIds[0];
        } else if (newPresentCount > oldPresentCount) {
          // Fallback fuer Rueckgabe ohne lesbare EEPROM-ID:
          // Legacy-Feld kurz auf eindeutigen Marker setzen, damit Return-Trigger feuern.
          const insertedSlot = !oldSlot1Present && newSlot1Present ? "1" : (!oldSlot2Present && newSlot2Present ? "2" : "x");
          update.powerbank_id = `ret_slot_${insertedSlot}_${Date.now()}`;
        } else {
          update.powerbank_id = null;
        }
      }

      // Legacy-Batteriewerte bei Dual-Slot weiter neutral halten.
      update.battery_voltage = null;
      update.battery_percentage = null;
    } else {
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
    }

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
