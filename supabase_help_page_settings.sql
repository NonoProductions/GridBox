-- Hilfe-Seite als editierbare Konfiguration fuer Dashboard und Public Page

CREATE TABLE IF NOT EXISTS public.help_page_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  intro_title TEXT NOT NULL DEFAULT 'Hilfe & Support',
  intro_subtitle TEXT NOT NULL DEFAULT 'Häufige Fragen und Kontaktmöglichkeiten',
  support_email TEXT NOT NULL DEFAULT 'support@gridbox.de',
  support_phone TEXT NOT NULL DEFAULT '+49 30 123 456 789',
  emergency_phone TEXT NOT NULL DEFAULT '+49 30 123 456 790',
  live_chat_hours TEXT NOT NULL DEFAULT 'Mo-Fr 9:00-18:00 Uhr',
  website_url TEXT NOT NULL DEFAULT 'www.gridbox.de',
  faqs JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.update_help_page_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_help_page_settings_updated_at ON public.help_page_settings;
CREATE TRIGGER update_help_page_settings_updated_at
  BEFORE UPDATE ON public.help_page_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_help_page_settings_updated_at();

ALTER TABLE public.help_page_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read help page settings" ON public.help_page_settings;
CREATE POLICY "Public can read help page settings" ON public.help_page_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owners can manage help page settings" ON public.help_page_settings;
CREATE POLICY "Owners can manage help page settings" ON public.help_page_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'owner'
    )
  );

INSERT INTO public.help_page_settings (
  id,
  intro_title,
  intro_subtitle,
  support_email,
  support_phone,
  emergency_phone,
  live_chat_hours,
  website_url,
  faqs
) VALUES (
  'default',
  'Hilfe & Support',
  'Häufige Fragen und Kontaktmöglichkeiten',
  'support@gridbox.de',
  '+49 30 123 456 789',
  '+49 30 123 456 790',
  'Mo-Fr 9:00-18:00 Uhr',
  'www.gridbox.de',
  $$[
    {"question":"Wie funktioniert das Ausleihen einer Powerbank?","answer":"1. Öffne die GridBox App und finde eine verfügbare Station auf der Karte\n2. Scanne den QR-Code an der Station\n3. Nimm die Powerbank aus dem Fach\n4. Lade dein Gerät auf\n5. Gib die Powerbank an einer beliebigen Station zurück"},
    {"question":"Was kostet das Ausleihen einer Powerbank?","answer":"Das Ausleihen einer Powerbank kostet 2,50€ pro Stunde. Die Gebühr wird automatisch von deinem Wallet-Guthaben abgezogen. Du kannst dein Guthaben jederzeit in der App aufladen."},
    {"question":"Wo kann ich eine Powerbank zurückgeben?","answer":"Du kannst deine Powerbank an jeder GridBox Station zurückgeben - nicht nur an der Station, wo du sie ausgeliehen hast. Einfach ein freies Fach an einer beliebigen Station finden und die Powerbank hineinlegen."},
    {"question":"Was passiert, wenn ich die Powerbank nicht zurückgebe?","answer":"Wenn du die Powerbank nicht innerhalb von 24 Stunden zurückgibst, wird eine zusätzliche Gebühr von 5€ pro Tag berechnet. Nach 7 Tagen wird der volle Wert der Powerbank (25€) von deinem Guthaben abgezogen."},
    {"question":"Wie lade ich mein Wallet auf?","answer":"Gehe in der App zu 'Wallet' und klicke auf 'Geld hinzufügen'. Du kannst zwischen vordefinierten Beträgen (5€, 10€, 20€, 50€) wählen oder einen eigenen Betrag eingeben. Die Zahlung erfolgt sicher über deine hinterlegte Zahlungsmethode."},
    {"question":"Wie finde ich die nächste Station?","answer":"Die App zeigt dir alle verfügbaren Stationen auf der Karte an. Grüne Marker zeigen Stationen mit verfügbaren Powerbanks. Du kannst auch den 'Standort zentrieren' Button verwenden, um deine Position zu finden."}
  ]$$::jsonb
) ON CONFLICT (id) DO NOTHING;