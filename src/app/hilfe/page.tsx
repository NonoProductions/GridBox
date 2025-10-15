"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function HilfeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  
  // Get theme from URL parameter, default to dark mode
  const isDarkMode = searchParams.get("theme") === "light" ? false : true;

  const faqs = [
    {
      id: 1,
      question: "Wie funktioniert das Ausleihen einer Powerbank?",
      answer: "1. Öffne die GridBox App und finde eine verfügbare Station auf der Karte\n2. Scanne den QR-Code an der Station\n3. Nimm die Powerbank aus dem Fach\n4. Lade dein Gerät auf\n5. Gib die Powerbank an einer beliebigen Station zurück"
    },
    {
      id: 2,
      question: "Was kostet das Ausleihen einer Powerbank?",
      answer: "Das Ausleihen einer Powerbank kostet 2,50€ pro Stunde. Die Gebühr wird automatisch von deinem Wallet-Guthaben abgezogen. Du kannst dein Guthaben jederzeit in der App aufladen."
    },
    {
      id: 3,
      question: "Wo kann ich eine Powerbank zurückgeben?",
      answer: "Du kannst deine Powerbank an jeder GridBox Station zurückgeben - nicht nur an der Station, wo du sie ausgeliehen hast. Einfach ein freies Fach an einer beliebigen Station finden und die Powerbank hineinlegen."
    },
    {
      id: 4,
      question: "Was passiert, wenn ich die Powerbank nicht zurückgebe?",
      answer: "Wenn du die Powerbank nicht innerhalb von 24 Stunden zurückgibst, wird eine zusätzliche Gebühr von 5€ pro Tag berechnet. Nach 7 Tagen wird der volle Wert der Powerbank (25€) von deinem Guthaben abgezogen."
    },
    {
      id: 5,
      question: "Wie lade ich mein Wallet auf?",
      answer: "Gehe in der App zu 'Wallet' und klicke auf 'Geld hinzufügen'. Du kannst zwischen vordefinierten Beträgen (5€, 10€, 20€, 50€) wählen oder einen eigenen Betrag eingeben. Die Zahlung erfolgt sicher über deine hinterlegte Zahlungsmethode."
    },
    {
      id: 6,
      question: "Ist meine Powerbank leer?",
      answer: "Alle Powerbanks werden vor dem Ausleihen aufgeladen. Falls deine Powerbank leer ist, gib sie einfach zurück und leihe eine neue aus. Du erhältst eine Gutschrift für die nicht genutzte Zeit."
    },
    {
      id: 7,
      question: "Wie finde ich die nächste Station?",
      answer: "Die App zeigt dir alle verfügbaren Stationen auf der Karte an. Grüne Marker zeigen Stationen mit verfügbaren Powerbanks. Du kannst auch den 'Standort zentrieren' Button verwenden, um deine Position zu finden."
    },
    {
      id: 8,
      question: "Was mache ich bei technischen Problemen?",
      answer: "Bei technischen Problemen kannst du uns über die Support-Kontakte erreichen. Beschreibe das Problem so genau wie möglich und wir helfen dir schnell weiter. Du findest unsere Kontaktdaten unten auf dieser Seite."
    }
  ];

  const toggleFAQ = (id: number) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  return (
    <main className={`min-h-[calc(100vh-0px)] ${
      isDarkMode ? 'text-white' : 'text-slate-900'
    }`} style={isDarkMode ? { backgroundColor: "#282828" } : { backgroundColor: "#ffffff" }}>
      {/* Back button */}
      <div className="absolute top-4 left-4 z-10">
        <button
          type="button"
          onClick={() => {
            router.push(`/app?theme=${isDarkMode ? "dark" : "light"}`);
          }}
          aria-label="Zurück"
          className={`grid place-items-center h-10 w-10 rounded-full backdrop-blur-sm ${
            isDarkMode 
              ? 'bg-white/20 text-white hover:bg-white/30' 
              : 'bg-slate-200 text-slate-900 hover:bg-slate-300'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="15,18 9,12 15,6" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6 pt-4">
        {/* Header */}
        <div className="text-center">
          <h1 className={`text-2xl font-bold mb-2 ${
            isDarkMode ? 'text-white' : 'text-slate-900'
          }`}>
            Hilfe & Support
          </h1>
          <p className={`text-sm ${
            isDarkMode ? 'text-gray-400' : 'text-slate-500'
          }`}>
            Häufige Fragen und Kontaktmöglichkeiten
          </p>
        </div>

        {/* Quick Help Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className={`rounded-xl p-4 ${
            isDarkMode 
              ? 'bg-white/5 border border-white/10' 
              : 'bg-slate-50 border border-slate-200'
          }`}>
            <div className="text-center">
              <div className="grid place-items-center h-12 w-12 rounded-full bg-emerald-100 mx-auto mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div className={`text-sm font-medium ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}>
                FAQ
              </div>
              <div className={`text-xs ${
                isDarkMode ? 'text-gray-400' : 'text-slate-500'
              }`}>
                Häufige Fragen
              </div>
            </div>
          </div>
          
          <div className={`rounded-xl p-4 ${
            isDarkMode 
              ? 'bg-white/5 border border-white/10' 
              : 'bg-slate-50 border border-slate-200'
          }`}>
            <div className="text-center">
              <div className="grid place-items-center h-12 w-12 rounded-full bg-blue-100 mx-auto mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </div>
              <div className={`text-sm font-medium ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}>
                Support
              </div>
              <div className={`text-xs ${
                isDarkMode ? 'text-gray-400' : 'text-slate-500'
              }`}>
                Kontakt & Hilfe
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className={`rounded-xl border ${
          isDarkMode 
            ? 'bg-white/5 border-white/10' 
            : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="p-4 border-b border-slate-200 dark:border-white/10">
            <h3 className={`text-lg font-semibold ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}>
              Häufig gestellte Fragen
            </h3>
          </div>
          
          <div className="divide-y divide-slate-200 dark:divide-white/10">
            {faqs.map((faq) => (
              <div key={faq.id} className="p-4">
                <button
                  onClick={() => toggleFAQ(faq.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between">
                    <h4 className={`font-medium ${
                      isDarkMode ? 'text-white' : 'text-slate-900'
                    }`}>
                      {faq.question}
                    </h4>
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      width="20" 
                      height="20" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                      className={`transition-transform ${
                        expandedFAQ === faq.id ? 'rotate-180' : ''
                      } ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}
                    >
                      <polyline points="6,9 12,15 18,9" />
                    </svg>
                  </div>
                </button>
                
                {expandedFAQ === faq.id && (
                  <div className="mt-3">
                    <div className={`text-sm leading-relaxed whitespace-pre-line ${
                      isDarkMode ? 'text-gray-300' : 'text-slate-600'
                    }`}>
                      {faq.answer}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contact Section */}
        <div className={`rounded-xl border p-4 ${
          isDarkMode 
            ? 'bg-white/5 border-white/10' 
            : 'bg-slate-50 border-slate-200'
        }`}>
          <h3 className={`text-lg font-semibold mb-4 ${
            isDarkMode ? 'text-white' : 'text-slate-900'
          }`}>
            Kontakt & Support
          </h3>
          
          <div className="space-y-4">
            {/* Email */}
            <div className="flex items-center gap-3">
              <div className="grid place-items-center h-10 w-10 rounded-full bg-emerald-100">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <div>
                <div className={`font-medium ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}>
                  E-Mail Support
                </div>
                <div className={`text-sm ${
                  isDarkMode ? 'text-gray-400' : 'text-slate-500'
                }`}>
                  support@gridbox.de
                </div>
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-center gap-3">
              <div className="grid place-items-center h-10 w-10 rounded-full bg-blue-100">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </div>
              <div>
                <div className={`font-medium ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}>
                  Telefon Support
                </div>
                <div className={`text-sm ${
                  isDarkMode ? 'text-gray-400' : 'text-slate-500'
                }`}>
                  +49 30 123 456 789
                </div>
              </div>
            </div>

            {/* Chat */}
            <div className="flex items-center gap-3">
              <div className="grid place-items-center h-10 w-10 rounded-full bg-purple-100">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div>
                <div className={`font-medium ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}>
                  Live Chat
                </div>
                <div className={`text-sm ${
                  isDarkMode ? 'text-gray-400' : 'text-slate-500'
                }`}>
                  Mo-Fr 9:00-18:00 Uhr
                </div>
              </div>
            </div>

            {/* Website */}
            <div className="flex items-center gap-3">
              <div className="grid place-items-center h-10 w-10 rounded-full bg-orange-100">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <div>
                <div className={`font-medium ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}>
                  Website
                </div>
                <div className={`text-sm ${
                  isDarkMode ? 'text-gray-400' : 'text-slate-500'
                }`}>
                  www.gridbox.de
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className={`rounded-xl border p-4 ${
          isDarkMode 
            ? 'bg-red-900/20 border-red-800' 
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="grid place-items-center h-10 w-10 rounded-full bg-red-100">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <div className={`font-medium ${
                isDarkMode ? 'text-red-400' : 'text-red-700'
              }`}>
                Notfall-Support
              </div>
              <div className={`text-sm ${
                isDarkMode ? 'text-red-300' : 'text-red-600'
              }`}>
                Bei dringenden Problemen: +49 30 123 456 790
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function HilfePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Lädt...</div>}>
      <HilfeContent />
    </Suspense>
  );
}

