# Deployment & QR-Code Test

## Problem: QR-Code zeigt 404

### Mögliche Ursachen:

1. **App ist nicht deployed** auf Vercel
2. **Station hat keinen short_code** in der Datenbank
3. **URL stimmt nicht** mit Deployment überein

---

## ✅ Lösung 1: App auf Vercel deployen

### Schritt 1: Git Push
```bash
git add .
git commit -m "Add QR-Code feature with short codes"
git push
```

### Schritt 2: Vercel Deployment
- Gehe zu https://vercel.com/dashboard
- Das Projekt sollte **automatisch deployen**
- Warte bis Status: ✓ Ready

### Schritt 3: Teste die URL
Öffne: `https://gridbox-app.vercel.app/rent/TEST`
- Sollte zeigen: "Station nicht gefunden" (korrekt!)
- NICHT: 404 Fehler

---

## ✅ Lösung 2: Für lokales Testen

### Option A: QR-Code für localhost (temporär)

Ändere in `src/components/StationQRCode.tsx`:
```typescript
// Für lokales Testen:
const baseUrl = 'http://localhost:3000';

// Für Production:
// const baseUrl = 'https://gridbox-app.vercel.app';
```

### Option B: Direkter Test ohne QR-Code

Öffne direkt im Browser:
```
http://localhost:3000/rent/A3B7
```

Wenn das funktioniert → QR-Code ist korrekt!
Wenn 404 → Station hat keinen short_code

---

## ✅ Lösung 3: Prüfe short_codes in Datenbank

### In Supabase SQL Editor:
```sql
SELECT id, name, short_code FROM stations;
```

**Erwartung**: Jede Station hat einen short_code wie "A3B7"

**Falls NULL**: SQL-Script nochmal ausführen:
```sql
-- Generiere short_codes für alle Stationen
UPDATE stations 
SET short_code = (
  SELECT substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random() * 32 + 1)::int, 1) ||
         substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random() * 32 + 1)::int, 1) ||
         substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random() * 32 + 1)::int, 1) ||
         substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random() * 32 + 1)::int, 1)
)
WHERE short_code IS NULL;
```

---

## 🧪 Quick Test Checklist

- [ ] App ist deployed auf Vercel
- [ ] `https://gridbox-app.vercel.app` funktioniert
- [ ] Stationen haben short_codes in Datenbank
- [ ] `https://gridbox-app.vercel.app/rent/TEST` zeigt nicht 404
- [ ] QR-Code URL ist korrekt: `https://gridbox-app.vercel.app/rent/{CODE}`

---

## 📱 Nächste Schritte

1. **Prüfe**: Ist https://gridbox-app.vercel.app live?
2. **Falls nein**: Deploy auf Vercel
3. **Falls ja**: Prüfe ob Stationen short_codes haben
4. **Teste**: Öffne manuell `https://gridbox-app.vercel.app/rent/A3B7`

