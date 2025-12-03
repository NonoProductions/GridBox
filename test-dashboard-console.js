/**
 * DASHBOARD DIAGNOSE - Browser Konsole Test
 * 
 * Wie verwenden:
 * 1. Öffne das Dashboard im Browser: http://localhost:3000/dashboard
 * 2. Öffne die Browser-Konsole: F12 → Console Tab
 * 3. Kopiere diesen gesamten Code
 * 4. Füge ihn in die Konsole ein und drücke Enter
 */

console.clear();
console.log('🔍 DASHBOARD DIAGNOSE GESTARTET\n');
console.log('='.repeat(60));

(async function() {
  try {
    // Import Supabase Client
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    
    // Versuche Umgebungsvariablen zu lesen
    const supabaseUrl = process?.env?.NEXT_PUBLIC_SUPABASE_URL || 'NICHT GEFUNDEN';
    const supabaseKey = process?.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ VORHANDEN' : '❌ FEHLT';
    
    console.log('\n📋 1. UMGEBUNGSVARIABLEN');
    console.log('-'.repeat(60));
    console.log('Supabase URL:', supabaseUrl);
    console.log('Supabase Key:', supabaseKey);
    
    // Verwende window.supabase falls verfügbar
    if (!window.supabase) {
      console.error('❌ window.supabase ist nicht verfügbar!');
      console.log('\n💡 LÖSUNG: Stelle sicher, dass Supabase korrekt initialisiert wurde.');
      return;
    }
    
    const supabase = window.supabase;
    
    // Test 1: Authentifizierung prüfen
    console.log('\n🔐 2. AUTHENTIFIZIERUNG');
    console.log('-'.repeat(60));
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ Session-Fehler:', sessionError.message);
      return;
    }
    
    if (!session) {
      console.error('❌ NICHT EINGELOGGT');
      console.log('💡 LÖSUNG: Gehe zu /login und logge dich ein');
      return;
    }
    
    console.log('✅ Eingeloggt als:', session.user.email);
    console.log('User ID:', session.user.id);
    console.log('Session läuft ab:', new Date(session.expires_at * 1000).toLocaleString());
    
    // Test 2: Stationen abrufen
    console.log('\n📊 3. STATIONEN ABRUFEN');
    console.log('-'.repeat(60));
    
    const { data: stations, error: stationsError } = await supabase
      .from('stations')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (stationsError) {
      console.error('❌ FEHLER beim Laden der Stationen:');
      console.error('Code:', stationsError.code);
      console.error('Message:', stationsError.message);
      console.error('Details:', stationsError.details);
      console.error('Hint:', stationsError.hint);
      
      if (stationsError.message.includes('relation') && stationsError.message.includes('does not exist')) {
        console.log('\n💡 LÖSUNG: Die stations Tabelle existiert nicht!');
        console.log('   Führe supabase_universal_setup.sql in Supabase aus');
      } else if (stationsError.message.includes('policy')) {
        console.log('\n💡 LÖSUNG: RLS Policy blockiert Zugriff!');
        console.log('   Führe supabase_diagnose_stations.sql in Supabase aus');
      } else if (stationsError.code === '42P01') {
        console.log('\n💡 LÖSUNG: Tabelle nicht gefunden!');
        console.log('   Erstelle die stations Tabelle mit supabase_stations_table.sql');
      }
      
      return;
    }
    
    if (!stations || stations.length === 0) {
      console.warn('⚠️ KEINE STATIONEN GEFUNDEN');
      console.log('Die Abfrage war erfolgreich, aber es gibt keine Stationen in der Datenbank.');
      console.log('\n💡 LÖSUNG: Füge eine Test-Station hinzu:');
      console.log(`
INSERT INTO stations (
  name, location, address, short_code, 
  total_units, available_units, is_active, 
  rental_cost, owner_id
) VALUES (
  'Test Station',
  ST_SetSRID(ST_MakePoint(13.405, 52.52), 4326),
  'Teststraße 1, 10115 Berlin',
  'TEST01', 8, 8, true, 3.50,
  '${session.user.id}'
);
      `);
      return;
    }
    
    console.log('✅ STATIONEN ERFOLGREICH GELADEN!');
    console.log('Anzahl:', stations.length);
    console.log('\nStationen:');
    stations.forEach((station, index) => {
      console.log(`\n  ${index + 1}. ${station.name} (${station.short_code || 'kein Code'})`);
      console.log(`     ID: ${station.id}`);
      console.log(`     Aktiv: ${station.is_active ? '✅' : '❌'}`);
      console.log(`     Kapazität: ${station.available_units}/${station.total_units}`);
      console.log(`     Erstellt: ${new Date(station.created_at).toLocaleString()}`);
      if (station.updated_at) {
        const lastUpdate = new Date(station.updated_at);
        const secondsAgo = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
        console.log(`     Letzte Aktualisierung: vor ${secondsAgo}s`);
      }
    });
    
    // Test 3: Realtime testen
    console.log('\n📡 4. REALTIME-VERBINDUNG');
    console.log('-'.repeat(60));
    
    const channel = supabase
      .channel('test-stations')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'stations'
      }, (payload) => {
        console.log('📡 Realtime Update empfangen:', payload);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime-Verbindung aktiv');
          console.log('Realtime funktioniert! Updates werden automatisch empfangen.');
          setTimeout(() => {
            supabase.removeChannel(channel);
            console.log('✅ Test-Channel entfernt');
          }, 3000);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Realtime-Verbindung fehlgeschlagen');
          console.log('💡 LÖSUNG: Führe supabase_enable_realtime.sql aus');
        } else {
          console.log('Realtime Status:', status);
        }
      });
    
    // Zusammenfassung
    console.log('\n' + '='.repeat(60));
    console.log('📝 ZUSAMMENFASSUNG');
    console.log('='.repeat(60));
    console.log('✅ Authentifizierung: OK');
    console.log('✅ Datenbankverbindung: OK');
    console.log('✅ Stationen: ' + stations.length + ' gefunden');
    console.log('\n🎉 Alles funktioniert! Das Dashboard sollte die Stationen anzeigen.');
    console.log('Falls nicht, drücke F5 um die Seite neu zu laden.');
    
  } catch (error) {
    console.error('\n❌ KRITISCHER FEHLER:', error);
    console.error('Stack:', error.stack);
    
    console.log('\n💡 LÖSUNGEN:');
    console.log('1. Prüfe .env.local Datei auf korrekte Supabase Credentials');
    console.log('2. Starte den Dev-Server neu: npm run dev');
    console.log('3. Siehe DASHBOARD_STATIONEN_FIX.md für Details');
  }
})();

console.log('\n📖 Für detaillierte Anleitung siehe: DASHBOARD_STATIONEN_FIX.md');

