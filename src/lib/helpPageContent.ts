import { supabase } from "@/lib/supabaseClient";

export interface HelpFaqEntry {
  question: string;
  answer: string;
}

export interface HelpPageSettings {
  id: string;
  intro_title: string;
  intro_subtitle: string;
  support_email: string;
  support_phone: string;
  emergency_phone: string;
  live_chat_hours: string;
  website_url: string;
  faqs: HelpFaqEntry[];
  updated_at?: string | null;
}

const HELP_PAGE_SETTINGS_ID = "default";

const DEFAULT_FAQS: HelpFaqEntry[] = [
  {
    question: "Wie funktioniert das Ausleihen einer Powerbank?",
    answer:
      "1. Öffne die GridBox App und finde eine verfügbare Station auf der Karte\n2. Scanne den QR-Code an der Station\n3. Nimm die Powerbank aus dem Fach\n4. Lade dein Gerät auf\n5. Gib die Powerbank an einer beliebigen Station zurück",
  },
  {
    question: "Was kostet das Ausleihen einer Powerbank?",
    answer:
      "Das Ausleihen einer Powerbank kostet 2,50€ pro Stunde. Die Gebühr wird automatisch von deinem Wallet-Guthaben abgezogen. Du kannst dein Guthaben jederzeit in der App aufladen.",
  },
  {
    question: "Wo kann ich eine Powerbank zurückgeben?",
    answer:
      "Du kannst deine Powerbank an jeder GridBox Station zurückgeben - nicht nur an der Station, wo du sie ausgeliehen hast. Einfach ein freies Fach an einer beliebigen Station finden und die Powerbank hineinlegen.",
  },
  {
    question: "Was passiert, wenn ich die Powerbank nicht zurückgebe?",
    answer:
      "Wenn du die Powerbank nicht innerhalb von 24 Stunden zurückgibst, wird eine zusätzliche Gebühr von 5€ pro Tag berechnet. Nach 7 Tagen wird der volle Wert der Powerbank (25€) von deinem Guthaben abgezogen.",
  },
  {
    question: "Wie lade ich mein Wallet auf?",
    answer:
      "Gehe in der App zu 'Wallet' und klicke auf 'Geld hinzufügen'. Du kannst zwischen vordefinierten Beträgen (5€, 10€, 20€, 50€) wählen oder einen eigenen Betrag eingeben. Die Zahlung erfolgt sicher über deine hinterlegte Zahlungsmethode.",
  },
  {
    question: "Wie finde ich die nächste Station?",
    answer:
      "Die App zeigt dir alle verfügbaren Stationen auf der Karte an. Grüne Marker zeigen Stationen mit verfügbaren Powerbanks. Du kannst auch den 'Standort zentrieren' Button verwenden, um deine Position zu finden.",
  },
];

export const DEFAULT_HELP_PAGE_SETTINGS: HelpPageSettings = {
  id: HELP_PAGE_SETTINGS_ID,
  intro_title: "Hilfe & Support",
  intro_subtitle: "Häufige Fragen und Kontaktmöglichkeiten",
  support_email: "support@gridbox.de",
  support_phone: "+49 30 123 456 789",
  emergency_phone: "+49 30 123 456 790",
  live_chat_hours: "Mo-Fr 9:00-18:00 Uhr",
  website_url: "www.gridbox.de",
  faqs: DEFAULT_FAQS,
  updated_at: null,
};

function sanitizeText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed.slice(0, maxLength);
}

function sanitizeFaqs(value: unknown): HelpFaqEntry[] {
  if (!Array.isArray(value)) {
    return DEFAULT_FAQS;
  }

  const faqs = value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const faq = entry as Partial<HelpFaqEntry>;
      const question = sanitizeText(faq.question, "", 180);
      const answer = sanitizeText(faq.answer, "", 2000);

      if (!question || !answer) {
        return null;
      }

      return { question, answer };
    })
    .filter((entry): entry is HelpFaqEntry => Boolean(entry))
    .slice(0, 12);

  return faqs.length > 0 ? faqs : DEFAULT_FAQS;
}

export function normalizeHelpPageSettings(value: Partial<HelpPageSettings> | null | undefined): HelpPageSettings {
  const source = value ?? {};

  return {
    id: HELP_PAGE_SETTINGS_ID,
    intro_title: sanitizeText(source.intro_title, DEFAULT_HELP_PAGE_SETTINGS.intro_title, 120),
    intro_subtitle: sanitizeText(source.intro_subtitle, DEFAULT_HELP_PAGE_SETTINGS.intro_subtitle, 180),
    support_email: sanitizeText(source.support_email, DEFAULT_HELP_PAGE_SETTINGS.support_email, 180),
    support_phone: sanitizeText(source.support_phone, DEFAULT_HELP_PAGE_SETTINGS.support_phone, 80),
    emergency_phone: sanitizeText(source.emergency_phone, DEFAULT_HELP_PAGE_SETTINGS.emergency_phone, 80),
    live_chat_hours: sanitizeText(source.live_chat_hours, DEFAULT_HELP_PAGE_SETTINGS.live_chat_hours, 120),
    website_url: sanitizeText(source.website_url, DEFAULT_HELP_PAGE_SETTINGS.website_url, 180),
    faqs: sanitizeFaqs(source.faqs),
    updated_at: source.updated_at ?? null,
  };
}

export async function fetchHelpPageSettings(): Promise<HelpPageSettings> {
  const { data, error } = await supabase
    .from("help_page_settings")
    .select("*")
    .eq("id", HELP_PAGE_SETTINGS_ID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normalizeHelpPageSettings((data as Partial<HelpPageSettings> | null) ?? null);
}

export async function saveHelpPageSettings(settings: HelpPageSettings): Promise<void> {
  const payload = normalizeHelpPageSettings(settings);

  const { error } = await supabase.from("help_page_settings").upsert(
    {
      id: HELP_PAGE_SETTINGS_ID,
      intro_title: payload.intro_title,
      intro_subtitle: payload.intro_subtitle,
      support_email: payload.support_email,
      support_phone: payload.support_phone,
      emergency_phone: payload.emergency_phone,
      live_chat_hours: payload.live_chat_hours,
      website_url: payload.website_url,
      faqs: payload.faqs,
    },
    { onConflict: "id" }
  );

  if (error) {
    throw error;
  }
}
