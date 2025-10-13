"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

function VerlaufContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get theme from URL parameter, default to dark mode
  const isDarkMode = searchParams.get("theme") === "light" ? false : true;

  // Sample transaction data
  const transactions = [
    {
      id: 1,
      type: "charge",
      title: "Guthaben aufgeladen",
      amount: 50.00,
      date: "Heute, 14:30",
      icon: "plus",
      color: "emerald"
    },
    {
      id: 2,
      type: "rental",
      title: "Powerbank ausgeliehen",
      subtitle: "Hauptbahnhof Station",
      amount: -2.50,
      date: "Gestern, 16:45",
      icon: "battery",
      color: "blue"
    },
    {
      id: 3,
      type: "return",
      title: "Powerbank zurückgegeben",
      subtitle: "Hauptbahnhof Station",
      amount: 0.00,
      date: "Gestern, 18:20",
      icon: "check",
      color: "green"
    },
    {
      id: 4,
      type: "charge",
      title: "Guthaben aufgeladen",
      amount: 25.00,
      date: "Vor 3 Tagen, 10:15",
      icon: "plus",
      color: "emerald"
    },
    {
      id: 5,
      type: "rental",
      title: "Powerbank ausgeliehen",
      subtitle: "City Mall Station",
      amount: -2.50,
      date: "Vor 4 Tagen, 12:30",
      icon: "battery",
      color: "blue"
    },
    {
      id: 6,
      type: "return",
      title: "Powerbank zurückgegeben",
      subtitle: "City Mall Station",
      amount: 0.00,
      date: "Vor 4 Tagen, 15:45",
      icon: "check",
      color: "green"
    },
    {
      id: 7,
      type: "charge",
      title: "Guthaben aufgeladen",
      amount: 20.00,
      date: "Vor 1 Woche, 09:00",
      icon: "plus",
      color: "emerald"
    },
    {
      id: 8,
      type: "rental",
      title: "Powerbank ausgeliehen",
      subtitle: "Stadttor Station",
      amount: -2.50,
      date: "Vor 1 Woche, 11:15",
      icon: "battery",
      color: "blue"
    }
  ];

  const getIcon = (iconType: string) => {
    switch (iconType) {
      case "plus":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        );
      case "battery":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s-7-4.35-7-10a7 7 0 1 1 14 0c0 5.65-7 10-7 10z"/>
            <path d="M13 11h3l-4 6v-4H9l4-6v4z" fill="currentColor"/>
          </svg>
        );
      case "check":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20,6 9,17 4,12" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getColorClasses = (color: string) => {
    switch (color) {
      case "emerald":
        return "bg-emerald-100 text-emerald-600";
      case "blue":
        return "bg-blue-100 text-blue-600";
      case "green":
        return "bg-green-100 text-green-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <main className={`min-h-[calc(100vh-0px)] ${
      isDarkMode ? 'text-white' : 'text-slate-900'
    }`} style={isDarkMode ? { backgroundColor: "#282828" } : { backgroundColor: "#ffffff" }}>
      {/* Back button */}
      <div className="absolute top-20 left-4 z-10" style={{ top: "calc(env(safe-area-inset-top, 0px) + 80px)" }}>
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
      <div className="p-6 space-y-6" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 80px)" }}>
        {/* Header */}
        <div className="text-center">
          <h1 className={`text-2xl font-bold mb-2 ${
            isDarkMode ? 'text-white' : 'text-slate-900'
          }`}>
            Verlauf
          </h1>
          <p className={`text-sm ${
            isDarkMode ? 'text-gray-400' : 'text-slate-500'
          }`}>
            Deine Transaktionshistorie
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className={`rounded-xl p-4 ${
            isDarkMode 
              ? 'bg-white/5 border border-white/10' 
              : 'bg-slate-50 border border-slate-200'
          }`}>
            <div className="text-center">
              <div className={`text-2xl font-bold ${
                isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
              }`}>
                {transactions.filter(t => t.amount > 0).length}
              </div>
              <div className={`text-sm ${
                isDarkMode ? 'text-gray-400' : 'text-slate-500'
              }`}>
                Aufladungen
              </div>
            </div>
          </div>
          
          <div className={`rounded-xl p-4 ${
            isDarkMode 
              ? 'bg-white/5 border border-white/10' 
              : 'bg-slate-50 border border-slate-200'
          }`}>
            <div className="text-center">
              <div className={`text-2xl font-bold ${
                isDarkMode ? 'text-blue-400' : 'text-blue-600'
              }`}>
                {transactions.filter(t => t.amount < 0).length}
              </div>
              <div className={`text-sm ${
                isDarkMode ? 'text-gray-400' : 'text-slate-500'
              }`}>
                Ausleihen
              </div>
            </div>
          </div>
        </div>

        {/* Transactions List */}
        <div className={`rounded-xl border ${
          isDarkMode 
            ? 'bg-white/5 border-white/10' 
            : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="p-4 border-b border-slate-200 dark:border-white/10">
            <h3 className={`text-lg font-semibold ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}>
              Alle Transaktionen
            </h3>
          </div>
          
          <div className="divide-y divide-slate-200 dark:divide-white/10">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`grid place-items-center h-10 w-10 rounded-full ${getColorClasses(transaction.color)}`}>
                      {getIcon(transaction.icon)}
                    </div>
                    <div>
                      <div className={`font-medium ${
                        isDarkMode ? 'text-white' : 'text-slate-900'
                      }`}>
                        {transaction.title}
                      </div>
                      {transaction.subtitle && (
                        <div className={`text-sm ${
                          isDarkMode ? 'text-gray-400' : 'text-slate-500'
                        }`}>
                          {transaction.subtitle}
                        </div>
                      )}
                      <div className={`text-sm ${
                        isDarkMode ? 'text-gray-400' : 'text-slate-500'
                      }`}>
                        {transaction.date}
                      </div>
                    </div>
                  </div>
                  <div className={`font-semibold ${
                    transaction.amount > 0 
                      ? isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
                      : transaction.amount < 0
                        ? isDarkMode ? 'text-red-400' : 'text-red-600'
                        : isDarkMode ? 'text-gray-400' : 'text-slate-500'
                  }`}>
                    {transaction.amount > 0 ? '+' : ''}€{transaction.amount.toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Load More Button */}
        <button className={`w-full py-3 rounded-xl font-medium transition-colors ${
          isDarkMode
            ? 'bg-white/10 text-white hover:bg-white/20'
            : 'bg-slate-200 text-slate-900 hover:bg-slate-300'
        }`}>
          Mehr laden
        </button>
      </div>
    </main>
  );
}

export default function VerlaufPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Lädt...</div>}>
      <VerlaufContent />
    </Suspense>
  );
}

