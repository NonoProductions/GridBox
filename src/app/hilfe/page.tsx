"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { usePageTheme } from "@/lib/usePageTheme";
import { DEFAULT_HELP_PAGE_SETTINGS, fetchHelpPageSettings } from "@/lib/helpPageContent";

function HilfeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [helpSettings, setHelpSettings] = useState(DEFAULT_HELP_PAGE_SETTINGS);
  const [contentLoading, setContentLoading] = useState(true);
  const [contentError, setContentError] = useState<string | null>(null);
  const isDarkMode = usePageTheme(searchParams);

  useEffect(() => {
    let isCancelled = false;

    (async () => {
      try {
        const settings = await fetchHelpPageSettings();
        if (!isCancelled) {
          setHelpSettings(settings);
        }
      } catch (error) {
        if (!isCancelled) {
          setContentError("Die Hilfeseite konnte nicht geladen werden. Es werden die Standardinhalte angezeigt.");
        }
      } finally {
        if (!isCancelled) {
          setContentLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, []);

  const toggleFAQ = (id: number) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  return (
    <main className="min-h-[calc(100vh-0px)] bg-white dark:bg-[#282828] text-slate-900 dark:text-white">
      {/* Back button */}
      <div className="absolute top-4 left-4 z-10">
        <button
          type="button"
          onClick={() => {
            const theme = isDarkMode ? "dark" : "light";
            router.push(`/app?theme=${theme}`);
          }}
          aria-label="Zurück"
          className="grid place-items-center h-10 w-10 rounded-full backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 text-slate-900 dark:text-white hover:bg-white dark:hover:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-lg transition-colors mt-[15px] mb-[15px]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="15,18 9,12 15,6" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="px-5 pt-20 pb-6 space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-[30px] font-bold mb-2 text-slate-900 dark:text-white flex flex-col justify-start items-center gap-0 -mt-[65px]">
            {helpSettings.intro_title}
          </h1>
          <p className="text-[13px] text-slate-500 dark:text-gray-400 -mt-[5px] -mb-[5px]">
            {helpSettings.intro_subtitle}
          </p>
          {contentLoading && (
            <p className="mt-2 text-xs text-slate-400 dark:text-gray-500">
              Inhalte werden geladen...
            </p>
          )}
          {contentError && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
              {contentError}
            </p>
          )}
        </div>

        {/* Quick Help Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <div className="text-center">
              <div className="grid place-items-center h-12 w-12 rounded-full bg-emerald-100 mx-auto mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                FAQ
              </div>
              <div className="text-xs text-slate-500 dark:text-gray-400">
                Häufige Fragen
              </div>
            </div>
          </div>
          
          <div className="rounded-xl p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <div className="text-center">
              <div className="grid place-items-center h-12 w-12 rounded-full bg-blue-100 mx-auto mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                Support
              </div>
              <div className="text-xs text-slate-500 dark:text-gray-400">
                Kontakt & Hilfe
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Häufig gestellte Fragen
            </h3>
          </div>
          
          <div className="space-y-3">
            {helpSettings.faqs.map((faq, index) => (
              <div key={`${faq.question}-${index}`} className="py-3 border-b border-slate-200 dark:border-white/10 last:border-0">
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-slate-900 dark:text-white">
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
                      className={`transition-transform text-slate-500 dark:text-gray-400 ${
                        expandedFAQ === index ? 'rotate-180' : ''
                      }`}
                    >
                      <polyline points="6,9 12,15 18,9" />
                    </svg>
                  </div>
                </button>
                
                {expandedFAQ === index && (
                  <div className="mt-3">
                    <div className="text-sm leading-relaxed whitespace-pre-line text-slate-600 dark:text-gray-300">
                      {faq.answer}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contact Section */}
        <div className="rounded-xl border p-4 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10">
          <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">
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
                <div className="font-medium text-slate-900 dark:text-white">
                  E-Mail Support
                </div>
                <div className="text-sm text-slate-500 dark:text-gray-400">
                  {helpSettings.support_email}
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
                <div className="font-medium text-slate-900 dark:text-white">
                  Telefon Support
                </div>
                <div className="text-sm text-slate-500 dark:text-gray-400">
                  {helpSettings.support_phone}
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
                <div className="font-medium text-slate-900 dark:text-white">
                  Live Chat
                </div>
                <div className="text-sm text-slate-500 dark:text-gray-400">
                  {helpSettings.live_chat_hours}
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
                <div className="font-medium text-slate-900 dark:text-white">
                  Website
                </div>
                <div className="text-sm text-slate-500 dark:text-gray-400">
                  {helpSettings.website_url}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="rounded-xl border p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center h-10 w-10 rounded-full bg-red-100">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <div className="font-medium text-red-700 dark:text-red-400">
                Notfall-Support
              </div>
              <div className="text-sm text-red-600 dark:text-red-300">
                Bei dringenden Problemen: {helpSettings.emergency_phone}
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

