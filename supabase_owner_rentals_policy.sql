-- Owner-Dashboard: Einnahmen-Statistiken
-- Ermöglicht Besitzern, Ausleihen (rentals) ihrer Stationen zu lesen.
-- Einmalig in Supabase SQL-Editor ausführen.

-- Policy: Besitzer können Rentals ihrer Stationen lesen (für Einnahmen-Statistiken)
DROP POLICY IF EXISTS "Owners can view rentals for their stations" ON rentals;
CREATE POLICY "Owners can view rentals for their stations" ON rentals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stations s
      WHERE s.id = rentals.station_id AND s.owner_id = auth.uid()
    )
  );
