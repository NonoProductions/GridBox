# 🔧 Fix: Stationen laden nicht im Dashboard

## Problem
Die Stationen werden im Owner Dashboard nicht angezeigt.

## Mögliche Ursachen
1. ❌ Supabase-Umgebungsvariablen fehlen oder sind falsch
2. ❌ Row Level Security (RLS) Policies blockieren den Zugriff
3. ❌ Keine Stationen in der Datenbank vorhanden
4. ❌ Authentifizierung fehlgeschlagen

---

## ✅ Schritt-für-Schritt-Lösung

### Schritt 1: Browser-Konsole öffnen und Fehler prüfen

1. **Öffne das Dashboard** im Browser: `http://localhost:3000/dashboard`
2. **Öffne die Browser-Entwicklerkonsole**:
   - Chrome/Edge: `F12` oder `Strg + Shift + I`
   - Firefox: `F12`
3. **Wechsel zum Tab "Console"**
4. **Suche nach Fehlermeldungen**, insbesondere:
   - `❌ Supabase Fehler beim Laden der Stationen:`
   - `❌ Fehler beim Laden der Stationen:`
   - `📊 Lade Stationen...` (sollte sichtbar sein)
   - `✅ Stationen geladen:` (sollte die Anzahl anzeigen)

**Was sagt die Konsole?**
- ✅ `✅ Stationen geladen: 0 Stationen` → **Keine Stationen in DB** (weiter zu Schritt 3)
- ❌ `ApiError: Invalid API key` → **Umgebungsvariablen falsch** (weiter zu Schritt 2)
- ❌ `row-level security policy violation` → **RLS Problem** (weiter zu Schritt 4)

---

### Schritt 2: Supabase-Umgebungsvariablen prüfen

1. **Öffne dein Supabase Dashboard**: https://supabase.com/dashboard
2. **Wähle dein Projekt** aus
3. **Gehe zu Settings → API**
4. **Kopiere die Werte**:
   - **Project URL** (z.B. `https://xyz.supabase.co`)
   - **anon public** Key

5. **Öffne `.env.local`** im Projektordner und prüfe:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=dein_anon_key_hier
```

6. **Wenn Werte fehlen oder falsch sind**:
   - Korrigiere die Werte
   - **Speichere `.env.local`**
   - **Stoppe den Development Server** (`Strg + C`)
   - **Starte neu**: `npm run dev`

---

### Schritt 3: Prüfe ob Stationen in der Datenbank existieren

1. **Öffne Supabase Dashboard** → **Table Editor** → **stations**
2. **Siehst du Stationen in der Tabelle?**
   - ❌ **Nein, Tabelle leer** → Füge eine Test-Station hinzu:

```sql
-- Führe dies im SQL Editor aus (Supabase → SQL Editor)
INSERT INTO stations (
  name,
  location,
  address,
  short_code,
  total_units,
  available_units,
  is_active,
  rental_cost,
  owner_id
) VALUES (
  'Test Station',
  ST_SetSRID(ST_MakePoint(13.405, 52.52), 4326),
  'Teststraße 1, 10115 Berlin',
  'TEST01',
  8,
  8,
  true,
  3.50,
  (SELECT id FROM auth.users LIMIT 1)
);
```

3. **Aktualisiere das Dashboard** im Browser (`F5`)

---

### Schritt 4: Supabase RLS Policies reparieren

**Dies ist der häufigste Grund für das Problem!**

1. **Öffne Supabase Dashboard** → **SQL Editor**
2. **Erstelle eine neue Query**
3. **Kopiere und führe diese SQL aus**: `supabase_diagnose_stations.sql`

```bash
# Die Datei liegt im Projektordner
# Öffne sie und kopiere den Inhalt
```

4. **Führe die SQL aus** (Klick auf "Run")
5. **Prüfe die Ergebnisse**:
   - ✅ "Stations Tabelle existiert" → `true`
   - ✅ "RLS aktiviert" → `true`
   - ✅ Policies sollten erstellt werden
   - ✅ Test 1 sollte erfolgreich sein

6. **Aktualisiere das Dashboard** im Browser

---

### Schritt 5: Authentifizierung prüfen

1. **Öffne Browser-Konsole** (F12 → Console)
2. **Führe aus**:

```javascript
// Prüfe Session
const { data } = await window.supabase.auth.getSession();
console.log('Session:', data.session);
```

- ✅ **Session vorhanden** → Gut!
- ❌ **Keine Session** → **Du musst dich einloggen**

3. **Wenn keine Session**:
   - Gehe zu `/login`
   - Logge dich ein
   - Kehre zum Dashboard zurück

---

## 🔍 Erweiterte Diagnose

### Test 1: Direkte Supabase-Abfrage
```javascript
// Öffne Browser-Konsole (F12) und führe aus:
const { data, error } = await window.supabase
  .from('stations')
  .select('*');

console.log('Daten:', data);
console.log('Fehler:', error);
```

### Test 2: Auth-Status prüfen
```javascript
const { data: { session } } = await window.supabase.auth.getSession();
console.log('Eingeloggt:', !!session);
console.log('User:', session?.user?.email);
```

---

## 🎯 Schnell-Fix (Wenn nichts anderes hilft)

1. **Stoppe den Dev-Server**: `Strg + C`
2. **Lösche .next Cache**: 
   ```powershell
   Remove-Item -Recurse -Force .next
   ```
3. **Starte neu**: 
   ```powershell
   npm run dev
   ```
4. **Öffne Dashboard im Inkognito-Modus**: `Strg + Shift + N`
5. **Logge dich neu ein**

---

## ✅ Erfolgskriterien

Nach dem Fix solltest du sehen:
- ✅ Stationen erscheinen in der Liste
- ✅ In der Konsole: `✅ Stationen geladen: X Stationen`
- ✅ In der Konsole: `✅ Realtime-Verbindung aktiv`
- ✅ Keine roten Fehlermeldungen

---

## 📞 Immer noch Probleme?

**Teile diese Informationen:**
1. Fehlermeldung aus der Browser-Konsole (vollständig)
2. Ergebnis von Test 1 und Test 2 (siehe oben)
3. Output von `supabase_diagnose_stations.sql`

**Häufige Fehler:**
- `ApiError: Invalid API key` → Umgebungsvariablen falsch
- `row-level security policy violation` → RLS Policies fehlen
- `relation "stations" does not exist` → Tabelle nicht erstellt
- `Failed to fetch` → Supabase URL falsch oder nicht erreichbar

