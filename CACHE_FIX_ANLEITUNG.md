# 🔧 Cache-Problem beheben - Änderungen werden nicht angezeigt

## Problem
Änderungen am Station-Info-Panel werden nicht angezeigt, obwohl:
- ✅ Neu gestartet wurde
- ✅ Gepusht wurde
- ✅ Deployed wurde
- ✅ Andere Browser verwendet wurden

## Lösungsschritte

### 1. Build-Cache löschen (WICHTIG!)

**Option A: PowerShell Script ausführen**
```powershell
.\clear-cache-and-rebuild.ps1
```

**Option B: Manuell**
```powershell
# Lösche .next Verzeichnis
Remove-Item -Recurse -Force .next

# Baue neu
npm run build
```

### 2. Browser-Cache leeren

**Chrome/Edge:**
1. Öffne Entwicklertools (F12)
2. Rechtsklick auf den Reload-Button
3. Wähle "Cache leeren und hart neu laden" (Empty Cache and Hard Reload)

**Oder:**
- `Ctrl + Shift + R` (Windows)
- `Cmd + Shift + R` (Mac)

**Firefox:**
- `Ctrl + Shift + Delete` → Cache leeren
- `Ctrl + F5` für Hard-Refresh

**Safari:**
- `Cmd + Option + E` → Cache leeren
- `Cmd + R` für Reload

### 3. Service Worker prüfen (falls aktiv)

1. Entwicklertools öffnen (F12)
2. Gehe zu "Application" Tab
3. Klicke auf "Service Workers" (links)
4. Falls ein Service Worker registriert ist:
   - Klicke auf "Unregister"
   - Oder "Update" klicken

### 4. Deployment-Cache (Vercel/Netlify)

**Vercel:**
1. Gehe zu deinem Vercel Dashboard
2. Klicke auf dein Projekt
3. Gehe zu "Deployments"
4. Klicke auf die drei Punkte neben dem neuesten Deployment
5. Wähle "Redeploy" (ohne Cache)

**Oder via CLI:**
```bash
vercel --prod --force
```

### 5. Lokaler Dev-Server

Falls du lokal testest:
```powershell
# Stoppe den Server (Ctrl+C)
# Lösche Cache
Remove-Item -Recurse -Force .next
# Starte neu
npm run dev
```

### 6. Prüfe ob Änderungen wirklich committed sind

```powershell
git log -1 --stat
git diff HEAD~1 src/components/MapView.tsx
```

## Häufige Ursachen

1. **Next.js Build-Cache** - `.next` Verzeichnis enthält alte Builds
2. **Browser-Cache** - Browser cached JavaScript-Dateien aggressiv
3. **CDN-Cache** - Vercel/Netlify cached Assets für Performance
4. **Service Worker** - Kann alte Versionen cachen (ist aber aktuell deaktiviert)

## Debug-Tipps

1. **Prüfe Browser-Konsole:**
   - Öffne Entwicklertools (F12)
   - Gehe zu "Network" Tab
   - Aktiviere "Disable cache"
   - Reload die Seite
   - Prüfe ob neue Dateien geladen werden

2. **Prüfe Build-Output:**
   ```powershell
   npm run build
   # Prüfe ob MapView.tsx kompiliert wurde
   ```

3. **Prüfe Datei-Timestamp:**
   ```powershell
   Get-Item src/components/MapView.tsx | Select-Object LastWriteTime
   ```

## Wenn nichts hilft

1. **Kompletter Clean Build:**
   ```powershell
   Remove-Item -Recurse -Force .next
   Remove-Item -Recurse -Force node_modules
   npm install
   npm run build
   ```

2. **Prüfe ob Änderungen in der Datei sind:**
   ```powershell
   Get-Content src/components/MapView.tsx | Select-String "deine-änderung"
   ```

3. **Incognito/Private Mode testen:**
   - Öffne Browser im Inkognito-Modus
   - Teste dort - das umgeht alle Caches

