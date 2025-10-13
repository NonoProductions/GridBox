# Vercel Deployment Anleitung

## ⚠️ WICHTIG: Umgebungsvariablen auf Vercel setzen

Bevor die App funktioniert, müssen diese 3 Umgebungsvariablen auf Vercel konfiguriert werden:

### 1. Vercel Dashboard öffnen
- Gehe zu: https://vercel.com/dashboard
- Öffne dein Projekt "gridbox-pwa"
- Gehe zu: **Settings → Environment Variables**

### 2. Folgende Variablen hinzufügen:

#### NEXT_PUBLIC_SUPABASE_URL
- **Name:** `NEXT_PUBLIC_SUPABASE_URL`
- **Value:** Deine Supabase Project URL (z.B. `https://xxxxx.supabase.co`)
- **Environments:** ✓ Production, ✓ Preview, ✓ Development

#### NEXT_PUBLIC_SUPABASE_ANON_KEY
- **Name:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Value:** Dein Supabase Anon/Public Key
- **Environments:** ✓ Production, ✓ Preview, ✓ Development

#### NEXT_PUBLIC_MAPTILER_API_KEY
- **Name:** `NEXT_PUBLIC_MAPTILER_API_KEY`
- **Value:** Dein MapTiler API Key
- **Environments:** ✓ Production, ✓ Preview, ✓ Development

### 3. Redeploy auslösen
- Gehe zu: **Deployments**
- Klicke beim neuesten Deployment auf **"..." → Redeploy**
- ⚠️ WICHTIG: Deaktiviere "Use existing Build Cache"
- Klicke **"Redeploy"**

### 4. Warte 2-3 Minuten
Das neue Deployment sollte jetzt erfolgreich sein!

## 🔍 Wo finde ich meine Supabase Keys?

1. Gehe zu: https://supabase.com/dashboard
2. Öffne dein Projekt
3. Gehe zu: **Settings → API**
4. Kopiere:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 🗺️ Wo finde ich meinen MapTiler API Key?

1. Gehe zu: https://cloud.maptiler.com
2. Gehe zu: **Account → API Keys**
3. Kopiere deinen API Key → `NEXT_PUBLIC_MAPTILER_API_KEY`

## 📌 Production URL

Die richtige URL findest du im Vercel Dashboard:
- Klicke auf den **"Visit"** Button ODER
- Gehe zu: **Settings → Domains** → erste URL in der Liste

## ❌ Fehlerbehebung

### "ERR_NAME_NOT_RESOLVED"
- Browser-Cache leeren (Strg + Shift + Delete)
- DNS-Cache leeren: `ipconfig /flushdns` (Windows)
- Inkognito-Fenster verwenden

### Seite lädt, aber zeigt Fehler
- F12 öffnen und Console-Fehler prüfen
- Umgebungsvariablen auf Vercel überprüfen
- Runtime Logs im Vercel Dashboard prüfen

