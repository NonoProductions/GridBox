# Wallet System Setup

Dieses Dokument erklärt, wie das Wallet-System für die GridBox PWA funktioniert und wie es eingerichtet wird.

## Übersicht

Das Wallet-System ermöglicht es Benutzern:
- Guthaben aufzuladen
- Transaktionen zu verwalten
- Powerbank-Ausleihgebühren zu bezahlen
- Ihren Transaktionsverlauf einzusehen

## Datenbank-Setup

### 1. SQL-Setup ausführen

Führe die Datei `supabase_wallet_setup.sql` in deinem Supabase SQL Editor aus:

```sql
-- Die Datei erstellt folgende Tabellen:
-- 1. wallets: Speichert das Guthaben pro User
-- 2. transactions: Speichert alle Transaktionen
```

### 2. Was wird erstellt?

#### Tabelle: `wallets`
- `id` (UUID): Primärschlüssel
- `user_id` (UUID): Referenz zum User
- `balance` (DECIMAL): Aktuelles Guthaben
- `created_at`, `updated_at`: Zeitstempel

#### Tabelle: `transactions`
- `id` (UUID): Primärschlüssel
- `user_id` (UUID): Referenz zum User
- `wallet_id` (UUID): Referenz zum Wallet
- `type` (VARCHAR): Transaktionstyp ('charge', 'rental', 'return', 'refund')
- `amount` (DECIMAL): Betrag (positiv für Aufladungen, negativ für Ausgaben)
- `description` (TEXT): Beschreibung der Transaktion
- `station_id` (UUID): Optional - Referenz zur Station (bei Powerbank-Transaktionen)
- `metadata` (JSONB): Zusätzliche Daten
- `created_at`: Zeitstempel

### 3. Automatische Features

Das Setup-Script erstellt automatisch:

✅ **Auto-Wallet-Erstellung**: Jeder neue User bekommt automatisch ein Wallet mit 100€ Startguthaben

✅ **Row Level Security (RLS)**: Users können nur ihre eigenen Wallets und Transaktionen sehen

✅ **Stored Procedures**:
- `add_money_to_wallet()`: Fügt Guthaben sicher hinzu
- `create_rental_transaction()`: Erstellt Ausleih-Transaktionen

✅ **Trigger**: Automatische Aktualisierung von `updated_at`

## Frontend-Integration

### Wallet-Seite (`/wallet`)

Die Wallet-Seite zeigt:
- Aktuelles Guthaben (aus der Datenbank geladen)
- Funktion zum Guthaben aufladen
- Die letzten 3 Transaktionen
- Link zum vollständigen Verlauf

#### Features:
- **Echtzeit-Datenbank-Anbindung**: Alle Daten werden aus Supabase geladen
- **Geld hinzufügen**: Nutzt die `add_money_to_wallet()` Funktion
- **Schnellbeträge**: Vordefinierte Beträge (5€, 10€, 20€, 50€)
- **Eigener Betrag**: Beliebige Beträge können eingegeben werden

### Verlauf-Seite (`/verlauf`)

Die Verlauf-Seite zeigt:
- Alle Transaktionen in chronologischer Reihenfolge
- Zusammenfassung: Anzahl der Aufladungen und Ausleihen
- Detaillierte Informationen zu jeder Transaktion
- Farbcodierung: Grün für Aufladungen, Rot für Ausgaben

## Verwendung im Code

### Guthaben aufladen

```typescript
const { data, error } = await supabase.rpc('add_money_to_wallet', {
  p_user_id: user.id,
  p_amount: 20.00,
  p_description: 'Guthaben aufgeladen'
});

if (data && data.success) {
  console.log('Neues Guthaben:', data.new_balance);
}
```

### Powerbank-Ausleihe erstellen

```typescript
const { data, error } = await supabase.rpc('create_rental_transaction', {
  p_user_id: user.id,
  p_station_id: stationId,
  p_amount: 2.50,
  p_description: 'Powerbank ausgeliehen'
});
```

### Wallet-Balance abrufen

```typescript
const { data: walletData } = await supabase
  .from('wallets')
  .select('balance')
  .eq('user_id', user.id)
  .single();

console.log('Guthaben:', walletData.balance);
```

### Transaktionen abrufen

```typescript
const { data: transactions } = await supabase
  .from('transactions')
  .select('*')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })
  .limit(10);
```

## Sicherheit

### Row Level Security (RLS)

Alle Tabellen sind mit RLS geschützt:

1. **Wallets**: Users können nur ihr eigenes Wallet sehen und bearbeiten
2. **Transactions**: Users können nur ihre eigenen Transaktionen sehen

### Stored Procedures

Die Stored Procedures (`add_money_to_wallet` und `create_rental_transaction`) sind als `SECURITY DEFINER` markiert, was bedeutet:
- Sie laufen mit erhöhten Rechten
- Sie führen Validierungen durch (z.B. genug Guthaben vorhanden)
- Sie garantieren atomare Operationen (Balance-Update + Transaction-Insert)

## Transaktionstypen

| Typ | Beschreibung | Amount | Verwendung |
|-----|--------------|--------|------------|
| `charge` | Guthaben aufgeladen | Positiv | User lädt Geld auf |
| `rental` | Powerbank ausgeliehen | Negativ | Ausleihe einer Powerbank |
| `return` | Powerbank zurückgegeben | 0 oder Positiv | Rückgabe (kann Gutschrift enthalten) |
| `refund` | Rückerstattung | Positiv | Kulanz, Fehlerkorrektur |

## Nächste Schritte

### 1. SQL ausführen
```bash
# Öffne Supabase Dashboard > SQL Editor
# Führe supabase_wallet_setup.sql aus
```

### 2. Testen
```bash
# Starte die Anwendung
npm run dev

# Navigiere zu /wallet
# Teste das Aufladen von Guthaben
# Prüfe den Verlauf unter /verlauf
```

### 3. Integration mit Powerbank-System
Um das Wallet mit dem Powerbank-Ausleihen zu verbinden, füge in der MapView-Komponente beim Ausleihen einer Powerbank folgenden Code hinzu:

```typescript
// Beim Ausleihen einer Powerbank
const { data, error } = await supabase.rpc('create_rental_transaction', {
  p_user_id: user.id,
  p_station_id: selectedStation.id,
  p_amount: 2.50, // Oder dynamischer Preis
  p_description: `Powerbank ausgeliehen bei ${selectedStation.name}`
});

if (error) {
  // Zeige Fehler (z.B. nicht genug Guthaben)
  alert('Nicht genug Guthaben!');
} else {
  // Powerbank erfolgreich ausgeliehen
  // Aktualisiere UI
}
```

## Fehlerbehebung

### "Wallet nicht gefunden"
- Stelle sicher, dass der Trigger `trigger_create_wallet_on_signup` aktiv ist
- Führe manuell ein Wallet-Insert aus:
  ```sql
  INSERT INTO wallets (user_id, balance)
  VALUES ('[USER_ID]', 100.00);
  ```

### "Permission denied"
- Prüfe ob RLS-Policies korrekt sind
- Stelle sicher, dass der User eingeloggt ist
- Prüfe mit: `SELECT auth.uid();` ob die User-ID korrekt ist

### Transaktionen werden nicht angezeigt
- Prüfe ob Transaktionen vorhanden sind:
  ```sql
  SELECT * FROM transactions WHERE user_id = auth.uid();
  ```
- Stelle sicher, dass die RLS-Policy für SELECT aktiv ist

## Support

Bei Problemen:
1. Prüfe die Browser-Console auf Fehler
2. Prüfe Supabase Logs im Dashboard
3. Stelle sicher, dass alle Environment Variables gesetzt sind
4. Teste die SQL-Funktionen direkt im SQL Editor

