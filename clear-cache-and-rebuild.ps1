# PowerShell Script zum Löschen des Next.js Cache und Neubau
Write-Host "🧹 Lösche Next.js Build-Cache..." -ForegroundColor Yellow

# Lösche .next Verzeichnis
if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
    Write-Host "✅ .next Verzeichnis gelöscht" -ForegroundColor Green
} else {
    Write-Host "ℹ️  .next Verzeichnis existiert nicht" -ForegroundColor Cyan
}

# Lösche node_modules/.cache falls vorhanden
if (Test-Path "node_modules\.cache") {
    Remove-Item -Recurse -Force "node_modules\.cache"
    Write-Host "✅ node_modules/.cache gelöscht" -ForegroundColor Green
}

# Lösche TypeScript Build-Info
Get-ChildItem -Path . -Filter "*.tsbuildinfo" -Recurse -ErrorAction SilentlyContinue | Remove-Item -Force
Write-Host "✅ TypeScript Build-Info gelöscht" -ForegroundColor Green

Write-Host ""
Write-Host "🔨 Baue Projekt neu..." -ForegroundColor Yellow
npm run build

Write-Host ""
Write-Host "✅ Fertig! Bitte:" -ForegroundColor Green
Write-Host "1. Hard-Refresh im Browser: Ctrl+Shift+R (Windows) oder Cmd+Shift+R (Mac)" -ForegroundColor Cyan
Write-Host "2. Oder: Entwicklertools öffnen (F12) > Rechtsklick auf Reload-Button > 'Cache leeren und hart neu laden'" -ForegroundColor Cyan
Write-Host "3. Falls deployed: Warte 1-2 Minuten und versuche es erneut" -ForegroundColor Cyan

